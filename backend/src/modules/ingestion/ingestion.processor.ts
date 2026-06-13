import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { EmbeddingService } from '../embedding/embedding.service';
import { ChunkingService } from '../chunking/chunking.service';
import { ParserRegistry } from './parsers/parser.registry';
import { ParsedContent } from './parsers/parser.interface';
import * as fs from 'fs';
import * as path from 'path';

@Processor('ingestion')
export class IngestionProcessor {
  constructor(
    private prisma: PrismaService,
    private embeddingService: EmbeddingService,
    private chunkingService: ChunkingService,
    private parserRegistry: ParserRegistry,
  ) {}

  @Process('process-document')
  async processDocument(job: Job<{ documentId: string }>) {
    const { documentId } = job.data;
    const doc = await this.prisma.document.findUnique({ where: { id: documentId } });
    if (!doc) return;

    // 读取所属知识库的分块配置
    const kb = await this.prisma.knowledgeBase.findUnique({ where: { id: doc.kbId } });
    const chunkSize = kb?.chunkSize ?? 500;
    const chunkOverlap = kb?.chunkOverlap ?? 50;
    const chunkStrategy = kb?.chunkStrategy ?? 'recursive';

    try {
      // ──── Step 1: Parse ────
      await this.prisma.document.update({ where: { id: documentId }, data: { status: 'PARSING' } });

      let parsedContent: ParsedContent;

      if (doc.type === 'MARKDOWN' || !doc.filePath) {
        // Markdown 文档，直接使用 TextParser
        const textContent = doc.content || '';
        const textParser = this.parserRegistry.getParser('text/markdown');
        parsedContent = await textParser.parse('', Buffer.from(textContent, 'utf-8'));
      } else {
        // FILE 类型，根据 mimeType 选择解析器
        const filePath = path.join(process.cwd(), doc.filePath);
        if (!fs.existsSync(filePath)) {
          throw new Error(`文件不存在: ${filePath}`);
        }

        const mimeType = doc.mimeType || 'text/plain';
        const parser = this.parserRegistry.getParser(mimeType);
        parsedContent = await parser.parse(filePath);

        // 保存提取的文本到数据库
        await this.prisma.document.update({
          where: { id: documentId },
          data: { content: parsedContent.text },
        });
      }

      if (!parsedContent.text || parsedContent.text.trim().length === 0) {
        throw new Error('文档内容为空');
      }

      // ──── Step 2: Chunk ────
      await this.prisma.document.update({ where: { id: documentId }, data: { status: 'CHUNKING' } });

      // 删除旧的 chunks
      await this.prisma.chunk.deleteMany({ where: { documentId } });

      // 使用统一分块入口
      const chunkResults = this.chunkingService.chunk(
        parsedContent,
        chunkStrategy,
        { chunkSize, overlap: chunkOverlap },
      );

      if (chunkResults.length === 0) {
        throw new Error('文档分块后无内容');
      }

      // 创建 chunks（含父子关系）
      const createdChunks = [];
      for (let i = 0; i < chunkResults.length; i++) {
        const cr = chunkResults[i];
        // parentIndex 指向父块在数组中的索引，需要映射到实际 ID
        let parentId: string | null = null;
        if (cr.parentIndex !== undefined && cr.parentIndex < createdChunks.length) {
          parentId = createdChunks[cr.parentIndex].id;
        }

        const chunk = await this.prisma.chunk.create({
          data: {
            documentId,
            content: cr.content,
            chunkIndex: i,
            parentId,
            level: cr.level,
            startOffset: cr.startOffset,
            endOffset: cr.endOffset,
            chunkType: cr.type,
          },
        });
        createdChunks.push(chunk);
      }

      // ──── Step 3: Embed ────
      await this.prisma.document.update({ where: { id: documentId }, data: { status: 'EMBEDDING' } });

      // 只对叶子块（level=1 或独立块 level=0 且无子块）生成 embedding
      const leafChunks = createdChunks.filter(c => {
        // level=1 的子块一定有 embedding
        if (c.level === 1) return true;
        // level=0 且无子块引用 → 需要 embedding
        const hasChildren = createdChunks.some(other => other.parentId === c.id);
        return !hasChildren;
      });

      const batchSize = 10;
      for (let i = 0; i < leafChunks.length; i += batchSize) {
        const batch = leafChunks.slice(i, i + batchSize);
        const texts = batch.map(c => c.content);

        try {
          const embeddings = await this.embeddingService.embed(texts);

          await Promise.all(
            batch.map((chunk, idx) => {
              if (embeddings[idx]) {
                const embeddingStr = `[${embeddings[idx].join(',')}]`;
                return this.prisma.$executeRawUnsafe(
                  `UPDATE "Chunk" SET embedding = $1::vector WHERE id = $2`,
                  embeddingStr,
                  chunk.id,
                );
              }
              return Promise.resolve();
            }),
          );
        } catch (embedErr) {
          console.error('Embedding batch error:', embedErr);
          // 继续处理下一批
        }
      }

      // ──── Step 4: Complete ────
      await this.prisma.document.update({
        where: { id: documentId },
        data: { status: 'COMPLETED' },
      });
      console.log(`Document ${documentId} processed: ${createdChunks.length} chunks (${leafChunks.length} embedded), strategy=${chunkStrategy}`);
    } catch (err) {
      console.error(`Document ${documentId} processing failed:`, err);
      await this.prisma.document.update({
        where: { id: documentId },
        data: { status: 'FAILED' },
      });
      throw err;
    }
  }
}
