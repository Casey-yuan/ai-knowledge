import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import axios from 'axios';
import { RetrievalResult } from '../retrieval/retrieval.service';

const DEFAULT_API_BASE = 'https://dashscope.aliyuncs.com/api/v1';

@Injectable()
export class RerankService {
  constructor(private prisma: PrismaService) {}

  /** Read rerank config from DB (uses LLM provider's API key) */
  private async getConfig() {
    const provider = await this.prisma.llmProvider.findFirst({
      where: { isDefault: true },
    });
    return {
      apiKey: provider?.apiKey || '',
      apiBase: provider?.apiBase || DEFAULT_API_BASE,
    };
  }

  /**
   * 对检索结果进行二次排序
   * 使用 DashScope 的 gte-rerank 模型
   */
  async rerank(
    query: string,
    results: RetrievalResult[],
    topK: number,
  ): Promise<RetrievalResult[]> {
    if (!results || results.length === 0) return [];

    const config = await this.getConfig();
    if (!config.apiKey) {
      console.warn('Rerank skipped: LLM API Key 未配置');
      return results.slice(0, topK);
    }

    try {
      const res = await axios.post(
        `${config.apiBase}/services/rerank`,
        {
          model: 'gte-rerank',
          input: {
            query,
            documents: results.map((r) => r.content),
          },
          parameters: { top_n: topK, return_documents: false },
        },
        {
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        },
      );

      const rerankResults = res.data?.output?.results;
      if (!rerankResults || !Array.isArray(rerankResults)) {
        return results.slice(0, topK);
      }

      // 按 rerank 返回的顺序重排
      return rerankResults
        .map((r: any) => ({
          ...results[r.index],
          rerankScore: r.relevance_score,
        }))
        .sort(
          (a: RetrievalResult, b: RetrievalResult) =>
            (b.rerankScore || 0) - (a.rerankScore || 0),
        );
    } catch (err: any) {
      console.warn('Rerank failed, returning original order:', err.message);
      return results.slice(0, topK);
    }
  }
}
