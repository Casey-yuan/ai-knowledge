import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { RetrievalService } from '../retrieval/retrieval.service';

@Injectable()
export class ChatService {
  constructor(
    private prisma: PrismaService,
    private llmService: LlmService,
    private retrievalService: RetrievalService,
  ) {}

  // Get user's accessible KBs: own KBs + public KBs
  async getAccessibleKbIds(userId: string): Promise<string[]> {
    const kbs = await this.prisma.knowledgeBase.findMany({
      where: {
        OR: [
          { createdBy: userId },
          { isPublic: true },
        ],
      },
      select: { id: true },
    });
    return kbs.map(kb => kb.id);
  }

  async createConversation(kbId: string, userId: string, title?: string) {
    // 如果 kbId 为空或 'all'，使用第一个可访问的知识库作为默认
    let effectiveKbId = kbId;
    if (!effectiveKbId || effectiveKbId === 'all') {
      const accessibleKbs = await this.getAccessibleKbIds(userId);
      effectiveKbId = accessibleKbs[0] || '00000000-0000-0000-0000-000000000000';
    }
    return this.prisma.conversation.create({
      data: { kbId: effectiveKbId, userId, title },
    });
  }

  async getConversations(userId: string, kbId?: string) {
    const where: any = { userId };
    if (kbId) where.kbId = kbId;
    return this.prisma.conversation.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: { messages: { take: 1, orderBy: { createdAt: 'desc' } } },
    });
  }

  async getMessages(conversationId: string) {
    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
  }

  // Deduplicate citations by documentTitle
  private deduplicateCitations(citations: any[]) {
    const seen = new Set<string>();
    return citations.filter(c => {
      const key = c.documentTitle || c.chunkId;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  async sendMessage(conversationId: string, content: string, userId: string, kbId?: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conv) throw new Error('Conversation not found');

    // Save user message
    await this.prisma.message.create({
      data: { conversationId, role: 'user', content },
    });

    // Determine which KBs to search
    let searchKbIds: string[];
    if (kbId && kbId !== 'all') {
      searchKbIds = [kbId];
    } else {
      searchKbIds = await this.getAccessibleKbIds(userId);
    }
    
    // Retrieve relevant chunks
    const retrieved = await this.retrievalService.hybridSearchFused(
      searchKbIds, content, { topK: 5, threshold: 0.3 },
    );

    // Build context
    const context = retrieved
      .map((r, i) => `[${i + 1}] ${r.content} (来源: ${r.documentTitle})`)
      .join('\n\n');

    const systemPrompt = `你是一个专业的知识库问答助手。请基于以下检索到的知识片段回答用户的问题。
如果片段信息不足，请如实告知。回答时请标注引用来源的编号。
回答时使用 Markdown 格式，使内容更加清晰易读。

检索到的知识：
${context}`;

    // Get conversation history
    const recentMessages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const messages = [
      { role: 'system', content: systemPrompt },
      ...recentMessages.reverse().map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    const reply = await this.llmService.chat(messages);

    // Deduplicate citations
    const deduplicatedCitations = this.deduplicateCitations(
      retrieved.map(r => ({
        chunkId: r.id,
        documentTitle: r.documentTitle,
        content: r.content.slice(0, 200),
      }))
    );

    // Save assistant message
    const assistantMsg = await this.prisma.message.create({
      data: {
        conversationId,
        role: 'assistant',
        content: reply,
        citations: deduplicatedCitations,
      },
    });

    // Update conversation timestamp
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return assistantMsg;
  }

  async sendMessageStream(conversationId: string, content: string, userId: string, res: Response, kbId?: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conv) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: 'Conversation not found' })}\n\n`);
      res.end();
      return;
    }

    // Save user message
    await this.prisma.message.create({
      data: { conversationId, role: 'user', content },
    });

    // Determine which KBs to search
    let searchKbIds: string[];
    if (kbId && kbId !== 'all') {
      searchKbIds = [kbId];
    } else {
      searchKbIds = await this.getAccessibleKbIds(userId);
    }
    
    // Retrieve relevant chunks
    const retrieved = await this.retrievalService.hybridSearchFused(
      searchKbIds, content, { topK: 5, threshold: 0.3 },
    );

    // Build context
    const context = retrieved
      .map((r, i) => `[${i + 1}] ${r.content} (来源: ${r.documentTitle})`)
      .join('\n\n');

    const systemPrompt = `你是一个专业的知识库问答助手。请基于以下检索到的知识片段回答用户的问题。
如果片段信息不足，请如实告知。回答时请标注引用来源的编号。
回答时使用 Markdown 格式，使内容更加清晰易读。

检索到的知识：
${context}`;

    // Get conversation history
    const recentMessages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const messages = [
      { role: 'system', content: systemPrompt },
      ...recentMessages.reverse().map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    // Get stream from LLM
    const stream = await this.llmService.chatStream(messages);

    res.write(`data: ${JSON.stringify({ type: 'start' })}\n\n`);

    let fullReply = '';
    let buffer = '';

    return new Promise<void>((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => {
        buffer += chunk.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;

          const dataStr = trimmed.slice(5).trim();
          if (dataStr === '[DONE]') continue;

          try {
            const data = JSON.parse(dataStr);
            const text = data.output?.choices?.[0]?.message?.content || '';
            if (text) {
              fullReply += text;
              res.write(`data: ${JSON.stringify({ type: 'chunk', content: text })}\n\n`);
            }
          } catch {
            // ignore parse error
          }
        }
      });

      stream.on('end', async () => {
        // Process any remaining buffer
        if (buffer.trim()) {
          const trimmed = buffer.trim();
          if (trimmed.startsWith('data:')) {
            const dataStr = trimmed.slice(5).trim();
            if (dataStr !== '[DONE]') {
              try {
                const data = JSON.parse(dataStr);
                const text = data.output?.choices?.[0]?.message?.content || '';
                if (text) {
                  fullReply += text;
                  res.write(`data: ${JSON.stringify({ type: 'chunk', content: text })}\n\n`);
                }
              } catch {
                // ignore
              }
            }
          }
        }

        // Deduplicate citations
        const deduplicatedCitations = this.deduplicateCitations(
          retrieved.map(r => ({
            chunkId: r.id,
            documentTitle: r.documentTitle,
            content: r.content.slice(0, 200),
          }))
        );

        // Save assistant message
        await this.prisma.message.create({
          data: {
            conversationId,
            role: 'assistant',
            content: fullReply,
            citations: deduplicatedCitations,
          },
        });

        await this.prisma.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() },
        });

        res.write(`data: ${JSON.stringify({ type: 'done', citations: deduplicatedCitations })}\n\n`);
        res.end();
        resolve();
      });

      stream.on('error', (err: Error) => {
        res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
        res.end();
        reject(err);
      });
    });
  }

  async feedback(messageId: string, feedback: string) {
    return this.prisma.message.update({
      where: { id: messageId },
      data: { feedback },
    });
  }

  async getConversation(id: string) {
    const conv = await this.prisma.conversation.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!conv) throw new Error('Conversation not found');
    return conv;
  }

  async updateConversation(id: string, data: { title?: string }) {
    return this.prisma.conversation.update({
      where: { id },
      data,
    });
  }

  async deleteConversation(id: string) {
    // Messages will be cascade-deleted by Prisma
    await this.prisma.conversation.delete({ where: { id } });
    return { message: 'deleted' };
  }
}
