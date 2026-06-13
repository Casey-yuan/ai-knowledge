import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import axios from 'axios';

const DEFAULT_API_BASE = 'https://dashscope.aliyuncs.com/api/v1';

@Injectable()
export class EmbeddingService {
  constructor(private prisma: PrismaService) {}

  /** Read default embedding model config from DB */
  private async getConfig() {
    const model = await this.prisma.embeddingModel.findFirst({
      where: { isDefault: true },
    });
    return {
      apiKey: model?.apiKey || '',
      apiBase: model?.apiBase || DEFAULT_API_BASE,
      modelName: model?.modelName || 'text-embedding-v3',
      dimension: model?.dimension || 1024,
    };
  }

  async embed(texts: string[], model?: string): Promise<number[][]> {
    const config = await this.getConfig();
    if (!config.apiKey)
      throw new Error('Embedding API Key 未配置，请在系统设置中配置');

    const res = await axios.post(
      `${config.apiBase}/services/embeddings/text-embedding/text-embedding`,
      {
        model: model || config.modelName,
        input: { texts },
        parameters: { dimension: config.dimension },
      },
      {
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
      },
    );

    return res.data?.output?.embeddings?.map((e: any) => e.embedding) || [];
  }

  async embedSingle(text: string, model?: string): Promise<number[]> {
    const embeddings = await this.embed([text], model);
    return embeddings[0] || [];
  }
}
