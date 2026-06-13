import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IngestionService } from '../ingestion/ingestion.service';

/** Default values for all system settings */
const SETTING_DEFAULTS = {
  // Chunking
  'chunking.chunkSize': 500,
  'chunking.chunkOverlap': 50,
  'chunking.chunkStrategy': 'recursive',
  // Retrieval
  'retrieval.defaultTopK': 5,
  'retrieval.defaultThreshold': 0.7,
  'retrieval.queryRewrite': true,
  'retrieval.rerankEnabled': false,
  // SMS
  'sms.enabled': false,
  'sms.accessKeyId': '',
  'sms.accessKeySecret': '',
  'sms.signName': '',
  'sms.templateCode': '',
};

type SettingKey = keyof typeof SETTING_DEFAULTS;

@Injectable()
export class SystemService {
  constructor(
    private prisma: PrismaService,
    private ingestionService: IngestionService,
  ) {}

  // ─────────────────────────────────────────────
  // Generic key-value setting helpers
  // ─────────────────────────────────────────────

  /** Read a single setting value (with fallback to default) */
  async getSetting<T = any>(key: SettingKey): Promise<T> {
    const row = await this.prisma.systemSetting.findUnique({ where: { key } });
    if (row) return row.value as T;
    return SETTING_DEFAULTS[key] as T;
  }

  /** Read multiple settings at once */
  async getSettingsBatch(keys: SettingKey[]): Promise<Record<string, any>> {
    const rows = await this.prisma.systemSetting.findMany({
      where: { key: { in: keys } },
    });
    const map = new Map(rows.map((r) => [r.key, r.value]));
    const result: Record<string, any> = {};
    for (const k of keys) {
      result[k] = map.has(k) ? map.get(k) : SETTING_DEFAULTS[k];
    }
    return result;
  }

  /** Upsert a single setting */
  async setSetting(key: string, value: any): Promise<void> {
    await this.prisma.systemSetting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }

  /** Upsert multiple settings */
  async setSettingsBatch(entries: Record<string, any>): Promise<void> {
    const ops = Object.entries(entries).map(([key, value]) =>
      this.prisma.systemSetting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      }),
    );
    await Promise.all(ops);
  }

  // ─────────────────────────────────────────────
  // Dashboard statistics
  // ─────────────────────────────────────────────

  async getStats() {
    const [kbCount, docCount, chunkCount, conversationCount, queueStatus] =
      await Promise.all([
        this.prisma.knowledgeBase.count(),
        this.prisma.document.count(),
        this.prisma.chunk.count(),
        this.prisma.conversation.count(),
        this.ingestionService.getQueueStatus(),
      ]);

    // Per-KB breakdown
    const kbBreakdown = await this.prisma.knowledgeBase.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { documents: true, conversations: true } },
      },
    });
    const perKb = await Promise.all(
      kbBreakdown.map(async (kb) => {
        const cc = await this.prisma.chunk.count({
          where: { document: { kbId: kb.id } },
        });
        return {
          id: kb.id,
          name: kb.name,
          documentCount: kb._count.documents,
          conversationCount: kb._count.conversations,
          chunkCount: cc,
        };
      }),
    );

    // 7-day conversation trend
    const now = new Date();
    const trendDays = 7;
    const conversationTrend: { date: string; count: number }[] = [];
    for (let i = trendDays - 1; i >= 0; i--) {
      const dayStart = new Date(now);
      dayStart.setHours(0, 0, 0, 0);
      dayStart.setDate(dayStart.getDate() - i);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const count = await this.prisma.conversation.count({
        where: { createdAt: { gte: dayStart, lt: dayEnd } },
      });
      const dateStr = `${dayStart.getMonth() + 1}/${dayStart.getDate()}`;
      conversationTrend.push({ date: dateStr, count });
    }

    // Document status distribution
    const docStatusDist = await this.prisma.document.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    // API health — check DB config instead of env var
    const [embedding, llm] = await Promise.all([
      this.prisma.embeddingModel.findFirst({ where: { isDefault: true } }),
      this.prisma.llmProvider.findFirst({ where: { isDefault: true } }),
    ]);
    const embeddingHealthy = !!(embedding?.apiKey);
    const llmHealthy = !!(llm?.apiKey);

    // SMS health
    const smsEnabled = await this.getSetting<boolean>('sms.enabled');
    const smsSignName = await this.getSetting<string>('sms.signName');
    const smsHealthy = smsEnabled && !!smsSignName;

    return {
      knowledgeBases: kbCount,
      documentCount: docCount,
      documents: docCount,
      chunks: chunkCount,
      chunkCount: chunkCount,
      conversationCount,
      conversations: conversationCount,
      queue: queueStatus,
      perKb,
      conversationTrend,
      documentStatusDistribution: docStatusDist.map((d) => ({
        status: d.status,
        count: d._count.id,
      })),
      embeddingHealthy,
      llmHealthy,
      smsHealthy,
    };
  }

  // ─────────────────────────────────────────────
  // Audit logs
  // ─────────────────────────────────────────────

  async getAuditLogs(params: {
    page?: number;
    limit?: number;
    action?: string;
    resource?: string;
    userId?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    const {
      page = 1,
      limit = 50,
      action,
      resource,
      userId,
      dateFrom,
      dateTo,
    } = params;
    const skip =
      ((typeof page === 'string' ? parseInt(page, 10) : page) - 1) *
      (typeof limit === 'string' ? parseInt(limit, 10) : limit);
    const take = typeof limit === 'string' ? parseInt(limit, 10) : limit;
    const where: any = {};
    if (action) where.action = action;
    if (resource) where.resource = resource;
    if (userId) where.userId = userId;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setDate(end.getDate() + 1);
        where.createdAt.lt = end;
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, nickname: true, phone: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  // ─────────────────────────────────────────────
  // Settings: read all (for GET /system/settings)
  // ─────────────────────────────────────────────

  async getSettings() {
    // Read AI model providers from dedicated tables
    const [embedding, llm] = await Promise.all([
      this.prisma.embeddingModel.findFirst({ where: { isDefault: true } }),
      this.prisma.llmProvider.findFirst({ where: { isDefault: true } }),
    ]);

    // Read misc settings from SystemSetting table
    const miscKeys: SettingKey[] = [
      'chunking.chunkSize',
      'chunking.chunkOverlap',
      'chunking.chunkStrategy',
      'retrieval.defaultTopK',
      'retrieval.defaultThreshold',
      'retrieval.queryRewrite',
      'retrieval.rerankEnabled',
      'sms.enabled',
      'sms.signName',
      'sms.templateCode',
      'sms.accessKeyId',
      'sms.accessKeySecret',
    ];
    const misc = await this.getSettingsBatch(miscKeys);

    return {
      // ── Embedding model ──
      embeddingProvider: embedding?.provider || 'dashscope',
      embeddingModel: embedding?.modelName || 'text-embedding-v3',
      embeddingDimension: embedding?.dimension || 1024,
      embeddingApiKey: embedding?.apiKey
        ? maskApiKey(embedding.apiKey)
        : '',
      embeddingApiBase: embedding?.apiBase || '',
      // ── LLM model ──
      llmProvider: llm?.provider || 'dashscope',
      llmModel: llm?.modelName || 'qwen-plus',
      llmApiKey: llm?.apiKey ? maskApiKey(llm.apiKey) : '',
      llmApiBase: llm?.apiBase || '',
      // ── Retrieval ──
      queryRewrite: misc['retrieval.queryRewrite'],
      rerankEnabled: misc['retrieval.rerankEnabled'],
      defaultTopK: misc['retrieval.defaultTopK'],
      defaultThreshold: misc['retrieval.defaultThreshold'],
      // ── Chunking ──
      chunkSize: misc['chunking.chunkSize'],
      chunkOverlap: misc['chunking.chunkOverlap'],
      chunkStrategy: misc['chunking.chunkStrategy'],
      // ── SMS ──
      smsEnabled: misc['sms.enabled'],
      smsSignName: misc['sms.signName'],
      smsTemplateCode: misc['sms.templateCode'],
      smsAccessKeyId: misc['sms.accessKeyId']
        ? maskApiKey(misc['sms.accessKeyId'])
        : '',
      smsAccessKeySecret: misc['sms.accessKeySecret']
        ? maskApiKey(misc['sms.accessKeySecret'])
        : '',
    };
  }

  // ─────────────────────────────────────────────
  // Settings: update all (for PUT /system/settings)
  // ─────────────────────────────────────────────

  async updateSettings(data: any) {
    // ── 1. Embedding model (dedicated table) ──
    if (
      data.embeddingModel ||
      data.embeddingProvider ||
      data.embeddingApiKey ||
      data.embeddingApiBase !== undefined
    ) {
      const existing = await this.prisma.embeddingModel.findFirst({
        where: { isDefault: true },
      });
      const updateData: any = {};
      if (data.embeddingModel) updateData.modelName = data.embeddingModel;
      if (data.embeddingProvider) updateData.provider = data.embeddingProvider;
      if (data.embeddingDimension)
        updateData.dimension = data.embeddingDimension;
      // Only update apiKey if it's not a masked value
      if (data.embeddingApiKey && !isMasked(data.embeddingApiKey))
        updateData.apiKey = data.embeddingApiKey;
      if (data.embeddingApiBase !== undefined)
        updateData.apiBase = data.embeddingApiBase;

      await this.prisma.embeddingModel.upsert({
        where: { id: existing?.id || 'default-embedding' },
        create: {
          id: 'default-embedding',
          name: '默认 Embedding',
          provider: data.embeddingProvider || 'dashscope',
          modelName: data.embeddingModel || 'text-embedding-v3',
          dimension: data.embeddingDimension || 1024,
          apiKey: isMasked(data.embeddingApiKey)
            ? ''
            : data.embeddingApiKey || '',
          apiBase: data.embeddingApiBase || null,
          isDefault: true,
        },
        update: updateData,
      });
    }

    // ── 2. LLM provider (dedicated table) ──
    if (
      data.llmModel ||
      data.llmProvider ||
      data.llmApiKey ||
      data.llmApiBase !== undefined
    ) {
      const existing = await this.prisma.llmProvider.findFirst({
        where: { isDefault: true },
      });
      const updateData: any = {};
      if (data.llmModel) updateData.modelName = data.llmModel;
      if (data.llmProvider) updateData.provider = data.llmProvider;
      if (data.llmApiKey && !isMasked(data.llmApiKey))
        updateData.apiKey = data.llmApiKey;
      if (data.llmApiBase !== undefined)
        updateData.apiBase = data.llmApiBase;

      await this.prisma.llmProvider.upsert({
        where: { id: existing?.id || 'default-llm' },
        create: {
          id: 'default-llm',
          name: '默认 LLM',
          provider: data.llmProvider || 'dashscope',
          modelName: data.llmModel || 'qwen-plus',
          apiKey: isMasked(data.llmApiKey) ? '' : data.llmApiKey || '',
          apiBase: data.llmApiBase || null,
          isDefault: true,
        },
        update: updateData,
      });
    }

    // ── 3. Misc settings (SystemSetting key-value table) ──
    const miscUpdates: Record<string, any> = {};

    // Chunking
    if (data.chunkSize !== undefined)
      miscUpdates['chunking.chunkSize'] = Number(data.chunkSize);
    if (data.chunkOverlap !== undefined)
      miscUpdates['chunking.chunkOverlap'] = Number(data.chunkOverlap);
    if (data.chunkStrategy !== undefined)
      miscUpdates['chunking.chunkStrategy'] = data.chunkStrategy;

    // Retrieval
    if (data.defaultTopK !== undefined)
      miscUpdates['retrieval.defaultTopK'] = Number(data.defaultTopK);
    if (data.defaultThreshold !== undefined)
      miscUpdates['retrieval.defaultThreshold'] = Number(data.defaultThreshold);
    if (data.queryRewrite !== undefined)
      miscUpdates['retrieval.queryRewrite'] = !!data.queryRewrite;
    if (data.rerankEnabled !== undefined)
      miscUpdates['retrieval.rerankEnabled'] = !!data.rerankEnabled;

    // SMS
    if (data.smsEnabled !== undefined)
      miscUpdates['sms.enabled'] = !!data.smsEnabled;
    if (data.smsSignName !== undefined)
      miscUpdates['sms.signName'] = data.smsSignName;
    if (data.smsTemplateCode !== undefined)
      miscUpdates['sms.templateCode'] = data.smsTemplateCode;
    if (data.smsAccessKeyId && !isMasked(data.smsAccessKeyId))
      miscUpdates['sms.accessKeyId'] = data.smsAccessKeyId;
    if (data.smsAccessKeySecret && !isMasked(data.smsAccessKeySecret))
      miscUpdates['sms.accessKeySecret'] = data.smsAccessKeySecret;

    if (Object.keys(miscUpdates).length > 0) {
      await this.setSettingsBatch(miscUpdates);
    }

    return { message: 'ok' };
  }
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function maskApiKey(key: string): string {
  if (!key || key.length < 8) return '****';
  return key.slice(0, 4) + '****' + key.slice(-4);
}

function isMasked(value: string): boolean {
  return typeof value === 'string' && value.includes('****');
}
