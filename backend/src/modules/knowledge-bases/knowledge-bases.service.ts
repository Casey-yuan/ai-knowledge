import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RetrievalService } from '../retrieval/retrieval.service';

@Injectable()
export class KnowledgeBasesService {
  constructor(
    private prisma: PrismaService,
    private retrievalService: RetrievalService,
  ) {}

  // Find all KBs with access control: user's own + public KBs
  async findAll(params?: { page?: number; limit?: number; keyword?: string; userId?: string }) {
    const { page, limit, keyword, userId } = params || {};
    const where: any = {};
    
    // Access control: show user's own KBs + public KBs
    if (userId) {
      where.OR = [
        { createdBy: userId },
        { isPublic: true },
      ];
    } else {
      // If no userId, only show public KBs
      where.isPublic = true;
    }
    
    if (keyword) {
      where.AND = [
        {
          OR: [
            { name: { contains: keyword, mode: 'insensitive' } },
            { description: { contains: keyword, mode: 'insensitive' } },
          ],
        },
      ];
    }

    // Helper to transform KB data with proper counts
    const transformKb = (kb: any) => {
      const chunkCount = kb.documents?.reduce((sum: number, doc: any) => sum + (doc._count?.chunks || 0), 0) || 0;
      return {
        ...kb,
        documentCount: kb._count?.documents || 0,
        chunkCount,
        documents: undefined,
        _count: undefined,
      };
    };

    // If pagination params are provided, return paginated result
    if (page || limit) {
      const p = page || 1;
      const l = limit || 20;
      const skip = (p - 1) * l;
      const [data, total] = await Promise.all([
        this.prisma.knowledgeBase.findMany({
          where,
          skip,
          take: l,
          orderBy: { createdAt: 'desc' },
          include: {
            _count: { select: { documents: true } },
            documents: { select: { _count: { select: { chunks: true } } } },
          },
        }),
        this.prisma.knowledgeBase.count({ where }),
      ]);
      return { data: data.map(transformKb), total, page: p, limit: l };
    }

    // Otherwise return all (with counts for card display)
    const kbs = await this.prisma.knowledgeBase.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { documents: true } },
        documents: { select: { _count: { select: { chunks: true } } } },
      },
    });
    return kbs.map(transformKb);
  }

  // Get hot knowledge bases (public + high view count)
  async getHotKnowledgeBases(params: { page?: number; limit?: number }) {
    const { page = 1, limit = 10 } = params;
    const skip = (page - 1) * limit;
    const [kbs, total] = await Promise.all([
      this.prisma.knowledgeBase.findMany({
        where: { isPublic: true },
        orderBy: { viewCount: 'desc' },
        skip,
        take: limit,
        include: {
          _count: { select: { documents: true } },
          documents: { select: { _count: { select: { chunks: true } } } },
          creator: { select: { id: true, nickname: true, phone: true } },
        },
      }),
      this.prisma.knowledgeBase.count({ where: { isPublic: true } }),
    ]);
    
    const data = kbs.map(kb => {
      const chunkCount = kb.documents?.reduce((sum: number, doc: any) => sum + (doc._count?.chunks || 0), 0) || 0;
      return {
        ...kb,
        documentCount: kb._count?.documents || 0,
        chunkCount,
        creatorName: kb.creator?.nickname || kb.creator?.phone || '未知',
        documents: undefined,
        _count: undefined,
        creator: undefined,
      };
    });
    return { data, total, page, limit };
  }

  // Increment view count for a KB
  async incrementViewCount(id: string) {
    return this.prisma.knowledgeBase.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });
  }

  async findById(id: string) {
    return this.prisma.knowledgeBase.findUnique({ where: { id } });
  }

  async create(data: { name: string; description?: string; topK?: number; similarityThreshold?: number; isPublic?: boolean; createdBy?: string }) {
    return this.prisma.knowledgeBase.create({ data });
  }

  async update(id: string, data: { name?: string; description?: string; topK?: number; similarityThreshold?: number; isPublic?: boolean }) {
    return this.prisma.knowledgeBase.update({ where: { id }, data });
  }

  async remove(id: string) {
    await this.prisma.knowledgeBase.delete({ where: { id } });
    return { message: 'deleted' };
  }

  async testVectorRetrieval(kbId: string, query: string, topK: number, threshold: number) {
    return this.retrievalService.hybridSearch(kbId, query, topK, threshold);
  }

  async testFullTextRetrieval(kbId: string, query: string, topK: number) {
    return this.retrievalService.fullTextSearch(kbId, query, topK);
  }
}
