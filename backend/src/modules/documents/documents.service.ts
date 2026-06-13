import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IngestionService } from '../ingestion/ingestion.service';
import { DocumentType } from '@prisma/client';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class DocumentsService {
  constructor(
    private prisma: PrismaService,
    private ingestionService: IngestionService,
  ) {}

  async findByKbId(kbId: string, params: { page?: number; limit?: number }) {
    const { page = 1, limit = 50 } = params;
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.document.findMany({
        where: { kbId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { 
          tags: { include: { tag: true } },
          _count: { select: { chunks: true } },
        },
      }),
      this.prisma.document.count({ where: { kbId } }),
    ]);
    
    // Transform to include chunkCount
    const transformedData = data.map(doc => ({
      ...doc,
      chunkCount: doc._count?.chunks || 0,
      _count: undefined,
    }));
    
    return { data: transformedData, total, page, limit };
  }

  // Get hot documents (public + high view count)
  async getHotDocuments(params: { page?: number; limit?: number }) {
    const { page = 1, limit = 10 } = params;
    const skip = (page - 1) * limit;
    const where = { isPublic: true, status: 'COMPLETED' as const };
    const [docs, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        orderBy: { viewCount: 'desc' },
        skip,
        take: limit,
        include: {
          kb: { select: { id: true, name: true } },
          creator: { select: { id: true, nickname: true, phone: true } },
          _count: { select: { chunks: true } },
        },
      }),
      this.prisma.document.count({ where }),
    ]);
    
    const data = docs.map(doc => ({
      ...doc,
      chunkCount: doc._count?.chunks || 0,
      kbName: doc.kb?.name,
      creatorName: doc.creator?.nickname || doc.creator?.phone || '未知',
      kb: undefined,
      creator: undefined,
      _count: undefined,
    }));
    return { data, total, page, limit };
  }

  // Get user's recent documents (recently published/completed)
  async getRecentDocuments(userId: string, limit: number = 10) {
    const docs = await this.prisma.document.findMany({
      where: {
        OR: [
          { createdBy: userId },
          { kb: { createdBy: userId } },
        ],
        status: 'COMPLETED',
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      include: {
        kb: { select: { id: true, name: true } },
        _count: { select: { chunks: true } },
      },
    });
    
    return docs.map(doc => ({
      ...doc,
      chunkCount: doc._count?.chunks || 0,
      kbName: doc.kb?.name,
      kb: undefined,
      _count: undefined,
    }));
  }

  // Search documents by title/content
  async searchDocuments(query: string, userId: string, limit: number = 20) {
    const where: any = {
      status: 'COMPLETED',
      OR: [
        { title: { contains: query, mode: 'insensitive' } },
        { content: { contains: query, mode: 'insensitive' } },
      ],
    };
    
    // Access control: user's own docs + public docs
    if (userId) {
      where.AND = [
        {
          OR: [
            { createdBy: userId },
            { isPublic: true },
            { kb: { createdBy: userId } },
            { kb: { isPublic: true } },
          ],
        },
      ];
    } else {
      where.isPublic = true;
    }
    
    const docs = await this.prisma.document.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: limit,
      include: {
        kb: { select: { id: true, name: true } },
        _count: { select: { chunks: true } },
      },
    });
    
    return docs.map(doc => ({
      ...doc,
      chunkCount: doc._count?.chunks || 0,
      kbName: doc.kb?.name,
      kb: undefined,
      _count: undefined,
      // Truncate content for search results
      content: doc.content ? doc.content.substring(0, 200) + '...' : '',
    }));
  }

  async findById(id: string) {
    // Increment view count
    await this.prisma.document.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });
    
    return this.prisma.document.findUnique({
      where: { id },
      include: { tags: { include: { tag: true } }, chunks: true },
    });
  }

  async createMarkdown(kbId: string, userId: string, data: { title: string; content?: string; isPublic?: boolean }) {
    // Get KB to determine default isPublic value
    const kb = await this.prisma.knowledgeBase.findUnique({ where: { id: kbId } });
    const isPublic = data.isPublic !== undefined ? data.isPublic : (kb?.isPublic ?? true);
    
    return this.prisma.document.create({
      data: {
        kbId,
        title: data.title,
        content: data.content || '',
        type: DocumentType.MARKDOWN,
        status: 'PENDING',
        isPublic,
        createdBy: userId,
      },
    });
  }

  async updateContent(id: string, data: { title?: string; content?: string; isPublic?: boolean }) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new Error('Document not found');

    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.content !== undefined) updateData.content = data.content;
    if (data.isPublic !== undefined) updateData.isPublic = data.isPublic;

    await this.prisma.documentVersion.create({
      data: {
        documentId: id,
        content: doc.content,
        version: doc.version,
      },
    });

    return this.prisma.document.update({
      where: { id },
      data: {
        ...updateData,
        version: doc.version + 1,
      },
    });
  }

  async remove(id: string) {
    await this.prisma.document.delete({ where: { id } });
    return { message: 'deleted' };
  }

  async upload(kbId: string, userId: string, file: any, title?: string) {
    if (!file) throw new BadRequestException('未上传文件');

    // 修复 Windows 下 multer 中文文件名乱码（Latin-1 → UTF-8）
    let originalName = file.originalname || '';
    try {
      originalName = Buffer.from(originalName, 'latin1').toString('utf8');
    } catch { /* keep original */ }

    // Ensure upload directory exists
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Save file to disk
    const timestamp = Date.now();
    const ext = path.extname(originalName || '');
    const fileName = `${timestamp}_${Math.random().toString(36).slice(2, 8)}${ext}`;
    const filePath = path.join(uploadDir, fileName);
    fs.writeFileSync(filePath, file.buffer);

    // Get KB to determine default isPublic value
    const kb = await this.prisma.knowledgeBase.findUnique({ where: { id: kbId } });
    const isPublic = kb?.isPublic ?? true;

    // Create document record
    const doc = await this.prisma.document.create({
      data: {
        kbId,
        title: title || originalName || fileName,
        type: DocumentType.FILE,
        filePath: `uploads/${fileName}`,
        fileSize: file.size || 0,
        mimeType: file.mimetype || 'application/octet-stream',
        status: 'PENDING',
        isPublic,
        createdBy: userId,
      },
    });

    // Enqueue for ingestion (parse -> chunk -> embed)
    await this.ingestionService.enqueueDocument(doc.id);
    return doc;
  }

  async publish(id: string) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new BadRequestException('文档不存在');

    const updated = await this.prisma.document.update({
      where: { id },
      data: { status: 'PENDING' },
    });

    // Enqueue for ingestion processing
    await this.ingestionService.enqueueDocument(id);
    return updated;
  }

  async reindex(id: string) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new BadRequestException('文档不存在');

    // Delete existing chunks before re-indexing
    await this.prisma.chunk.deleteMany({ where: { documentId: id } });

    const updated = await this.prisma.document.update({
      where: { id },
      data: { status: 'PENDING' },
    });

    // Re-enqueue for ingestion
    await this.ingestionService.enqueueDocument(id);
    return updated;
  }
}
