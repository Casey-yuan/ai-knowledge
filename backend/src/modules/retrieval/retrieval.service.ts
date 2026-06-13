import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmbeddingService } from '../embedding/embedding.service';
import * as crypto from 'crypto';

export interface RetrievalFilters {
  tags?: string[];
  documentTypes?: string[];
  mimeTypes?: string[];
  dateFrom?: Date;
  dateTo?: Date;
  createdBy?: string;
}

export interface RetrievalResult {
  id: string;
  content: string;
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  similarity?: number;
  score?: number;
  vectorScore?: number;
  fulltextScore?: number;
  rerankScore?: number;
  parentId?: string | null;
  parentContent?: string | null;
}

@Injectable()
export class RetrievalService {
  /** Cached text search config name ('chinese' or 'simple') */
  private tsConfig: string | null = null;

  constructor(
    private prisma: PrismaService,
    private embeddingService: EmbeddingService,
  ) {}

  /** Detect whether 'chinese' ts_config exists; fallback to 'simple' */
  private async getTsConfig(): Promise<string> {
    if (this.tsConfig) return this.tsConfig;
    try {
      const rows: any[] = await this.prisma.$queryRawUnsafe(
        `SELECT 1 FROM pg_ts_config WHERE cfgname = 'chinese'`,
      );
      this.tsConfig = rows.length > 0 ? 'chinese' : 'simple';
    } catch {
      this.tsConfig = 'simple';
    }
    if (this.tsConfig === 'simple') {
      console.warn('[Retrieval] zhparser not available, using simple parser for full-text search');
    }
    return this.tsConfig;
  }

  // ─────────────────────────────────────────────
  // 主入口：融合检索（带缓存 + RRF + 可选过滤）
  // ─────────────────────────────────────────────
  async hybridSearchFused(
    kbIds: string[],
    query: string,
    options: {
      topK?: number;
      threshold?: number;
      vectorWeight?: number;
      fulltextWeight?: number;
      filters?: RetrievalFilters;
      useCache?: boolean;
    } = {},
  ): Promise<RetrievalResult[]> {
    const {
      topK = 5,
      threshold = 0.3,
      vectorWeight = 0.7,
      fulltextWeight = 0.3,
      filters,
      useCache = true,
    } = options;

    if (!kbIds || kbIds.length === 0) return [];

    // 缓存检查
    if (useCache) {
      const cached = await this.getCachedResults(kbIds, query, topK, threshold);
      if (cached) return cached;
    }

    // 并行执行两路检索（多召回 topK*3）
    const recallK = Math.max(topK * 3, 15);
    const [vectorResults, fulltextResults] = await Promise.all([
      this.vectorSearch(kbIds, query, recallK, threshold, filters),
      this.fullTextSearchMultiple(kbIds, query, recallK, filters),
    ]);

    // RRF 融合
    const fused = this.reciprocalRankFusion(
      vectorResults, fulltextResults, vectorWeight, fulltextWeight,
    );

    // 裁剪
    const results = fused
      .filter(r => (r.score || 0) >= threshold)
      .slice(0, topK);

    // 写入缓存
    if (useCache && results.length > 0) {
      await this.setCachedResults(kbIds, query, topK, threshold, results);
    }

    return results;
  }

  // ─────────────────────────────────────────────
  // 向量检索
  // ─────────────────────────────────────────────
  async vectorSearch(
    kbIds: string[],
    query: string,
    topK: number,
    threshold: number,
    filters?: RetrievalFilters,
  ): Promise<RetrievalResult[]> {
    const queryEmbedding = await this.embeddingService.embedSingle(query);
    const params: any[] = [JSON.stringify(queryEmbedding), kbIds, threshold, topK];

    const { sql: filterSql, params: filterParams } = this.buildFilterClause(filters, 5);
    const allParams = [...params, ...filterParams];

    const sql = `
      SELECT
        c.id, c.content, c."documentId", c."chunkIndex", c."parentId",
        1 - (c.embedding <=> $1::vector) as similarity,
        d.title as document_title
      FROM "Chunk" c
      JOIN "Document" d ON d.id = c."documentId"
      WHERE d.status = 'COMPLETED'
        AND d."kbId" = ANY($2)
        AND c.embedding IS NOT NULL
        AND 1 - (c.embedding <=> $1::vector) >= $3
        ${filterSql}
      ORDER BY similarity DESC
      LIMIT $4
    `;

    const rows: any[] = await this.prisma.$queryRawUnsafe(sql, ...allParams);

    return rows.map(r => ({
      id: r.id,
      content: r.content,
      documentId: r.documentId,
      documentTitle: r.document_title,
      chunkIndex: r.chunkIndex,
      similarity: Number(r.similarity),
      vectorScore: Number(r.similarity),
      parentId: r.parentId,
    }));
  }

  // ─────────────────────────────────────────────
  // 全文检索
  // ─────────────────────────────────────────────
  async fullTextSearchMultiple(
    kbIds: string[],
    query: string,
    topK: number,
    filters?: RetrievalFilters,
  ): Promise<RetrievalResult[]> {
    const tsCfg = await this.getTsConfig();
    const params: any[] = [query, kbIds, topK];
    const { sql: filterSql, params: filterParams } = this.buildFilterClause(filters, 4);
    const allParams = [...params, ...filterParams];

    const sql = `
      SELECT
        c.id, c.content, c."documentId", c."chunkIndex", c."parentId",
        ts_rank(to_tsvector('${tsCfg}', c.content), plainto_tsquery('${tsCfg}', $1)) as score,
        d.title as document_title
      FROM "Chunk" c
      JOIN "Document" d ON d.id = c."documentId"
      WHERE d.status = 'COMPLETED'
        AND d."kbId" = ANY($2)
        AND to_tsvector('${tsCfg}', c.content) @@ plainto_tsquery('${tsCfg}', $1)
        ${filterSql}
      ORDER BY score DESC
      LIMIT $3
    `;

    const rows: any[] = await this.prisma.$queryRawUnsafe(sql, ...allParams);

    return rows.map(r => ({
      id: r.id,
      content: r.content,
      documentId: r.documentId,
      documentTitle: r.document_title,
      chunkIndex: r.chunkIndex,
      fulltextScore: Number(r.score),
      parentId: r.parentId,
    }));
  }

  // ─────────────────────────────────────────────
  // RRF 融合排序
  // ─────────────────────────────────────────────
  private reciprocalRankFusion(
    vectorResults: RetrievalResult[],
    fulltextResults: RetrievalResult[],
    vectorWeight: number,
    fulltextWeight: number,
    k: number = 60,
  ): RetrievalResult[] {
    const scoreMap = new Map<string, { score: number; result: RetrievalResult }>();

    vectorResults.forEach((r, rank) => {
      const rrfScore = vectorWeight / (k + rank + 1);
      const existing = scoreMap.get(r.id);
      if (existing) {
        existing.score += rrfScore;
        existing.result.vectorScore = r.vectorScore;
      } else {
        scoreMap.set(r.id, { score: rrfScore, result: { ...r, vectorScore: r.vectorScore || r.similarity } });
      }
    });

    fulltextResults.forEach((r, rank) => {
      const rrfScore = fulltextWeight / (k + rank + 1);
      const existing = scoreMap.get(r.id);
      if (existing) {
        existing.score += rrfScore;
        existing.result.fulltextScore = r.fulltextScore;
      } else {
        scoreMap.set(r.id, { score: rrfScore, result: { ...r, fulltextScore: r.fulltextScore } });
      }
    });

    return Array.from(scoreMap.values())
      .sort((a, b) => b.score - a.score)
      .map(v => ({ ...v.result, score: v.score }));
  }

  // ─────────────────────────────────────────────
  // 元数据过滤条件构建
  // ─────────────────────────────────────────────
  private buildFilterClause(filters?: RetrievalFilters, startParam: number = 5): { sql: string; params: any[] } {
    if (!filters) return { sql: '', params: [] };

    const clauses: string[] = [];
    const params: any[] = [];
    let pi = startParam;

    if (filters.tags?.length) {
      clauses.push(`EXISTS (SELECT 1 FROM "DocTag" dt WHERE dt."documentId" = d.id AND dt."tagId" = ANY($${pi++}))`);
      params.push(filters.tags);
    }
    if (filters.documentTypes?.length) {
      clauses.push(`d.type = ANY($${pi++})`);
      params.push(filters.documentTypes);
    }
    if (filters.mimeTypes?.length) {
      clauses.push(`d."mimeType" = ANY($${pi++})`);
      params.push(filters.mimeTypes);
    }
    if (filters.dateFrom) {
      clauses.push(`d."createdAt" >= $${pi++}`);
      params.push(filters.dateFrom);
    }
    if (filters.dateTo) {
      clauses.push(`d."createdAt" <= $${pi++}`);
      params.push(filters.dateTo);
    }
    if (filters.createdBy) {
      clauses.push(`d."createdBy" = $${pi++}`);
      params.push(filters.createdBy);
    }

    return {
      sql: clauses.length > 0 ? 'AND ' + clauses.join(' AND ') : '',
      params,
    };
  }

  // ─────────────────────────────────────────────
  // 父子分块上下文检索
  // ─────────────────────────────────────────────
  async searchWithParentContext(
    kbIds: string[],
    query: string,
    options: { topK?: number; threshold?: number; filters?: RetrievalFilters } = {},
  ): Promise<RetrievalResult[]> {
    const results = await this.hybridSearchFused(kbIds, query, options);

    // 收集有 parentId 的结果
    const parentIds = [...new Set(
      results.filter(r => r.parentId).map(r => r.parentId!),
    )];

    if (parentIds.length === 0) return results;

    // 批量查询父块
    const parents = await this.prisma.chunk.findMany({
      where: { id: { in: parentIds } },
      select: { id: true, content: true },
    });
    const parentMap = new Map(parents.map(p => [p.id, p.content]));

    return results.map(r => ({
      ...r,
      parentContent: r.parentId ? (parentMap.get(r.parentId) || null) : null,
    }));
  }

  // ─────────────────────────────────────────────
  // 检索缓存
  // ─────────────────────────────────────────────
  private buildQueryHash(kbIds: string[], query: string, topK: number, threshold: number): string {
    const key = `${[...kbIds].sort().join(',')}:${query}:${topK}:${threshold}`;
    return crypto.createHash('md5').update(key).digest('hex');
  }

  private async getCachedResults(
    kbIds: string[], query: string, topK: number, threshold: number,
  ): Promise<RetrievalResult[] | null> {
    const queryHash = this.buildQueryHash(kbIds, query, topK, threshold);
    const cached = await this.prisma.retrievalCache.findUnique({ where: { queryHash } });

    if (cached && cached.expiresAt > new Date()) {
      await this.prisma.retrievalCache.update({
        where: { queryHash },
        data: { hitCount: { increment: 1 } },
      });
      return cached.results as unknown as RetrievalResult[];
    }

    if (cached) {
      await this.prisma.retrievalCache.delete({ where: { queryHash } });
    }
    return null;
  }

  private async setCachedResults(
    kbIds: string[], query: string, topK: number, threshold: number,
    results: RetrievalResult[], ttlSeconds: number = 300,
  ): Promise<void> {
    const queryHash = this.buildQueryHash(kbIds, query, topK, threshold);
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    await this.prisma.retrievalCache.upsert({
      where: { queryHash },
      create: {
        kbIds: [...kbIds].sort().join(','),
        query, queryHash, results: results as any, expiresAt,
      },
      update: { results: results as any, expiresAt, hitCount: { increment: 1 } },
    });
  }

  // ─────────────────────────────────────────────
  // 兼容旧接口
  // ─────────────────────────────────────────────
  async hybridSearch(kbId: string, query: string, topK = 5, threshold = 0.7) {
    const kbIds = (!kbId || kbId === 'all')
      ? (await this.prisma.knowledgeBase.findMany({ select: { id: true } })).map(k => k.id)
      : [kbId];
    return this.hybridSearchFused(kbIds, query, { topK, threshold, useCache: false });
  }

  async fullTextSearch(kbId: string, query: string, topK = 5) {
    const kbIds = (!kbId || kbId === 'all')
      ? (await this.prisma.knowledgeBase.findMany({ select: { id: true } })).map(k => k.id)
      : [kbId];
    return this.fullTextSearchMultiple(kbIds, query, topK);
  }
}
