import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import axios from 'axios';

const DEFAULT_API_BASE = 'https://dashscope.aliyuncs.com/api/v1';

@Injectable()
export class LlmService {
  constructor(private prisma: PrismaService) {}

  /** Read default LLM provider config from DB */
  private async getConfig() {
    const provider = await this.prisma.llmProvider.findFirst({
      where: { isDefault: true },
    });
    return {
      apiKey: provider?.apiKey || '',
      apiBase: provider?.apiBase || DEFAULT_API_BASE,
      modelName: provider?.modelName || 'qwen-plus',
    };
  }

  async chat(
    messages: Array<{ role: string; content: string }>,
    model?: string,
  ): Promise<string> {
    const config = await this.getConfig();
    if (!config.apiKey)
      throw new Error('LLM API Key 未配置，请在系统设置中配置');

    const res = await axios.post(
      `${config.apiBase}/services/aigc/text-generation/generation`,
      {
        model: model || config.modelName,
        input: { messages },
        parameters: {
          result_format: 'message',
          top_p: 0.8,
          temperature: 0.7,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
      },
    );

    return res.data?.output?.choices?.[0]?.message?.content || '';
  }

  async chatStream(
    messages: Array<{ role: string; content: string }>,
    model?: string,
  ): Promise<NodeJS.ReadableStream> {
    const config = await this.getConfig();
    if (!config.apiKey)
      throw new Error('LLM API Key 未配置，请在系统设置中配置');

    const res = await axios.post(
      `${config.apiBase}/services/aigc/text-generation/generation`,
      {
        model: model || config.modelName,
        input: { messages },
        parameters: {
          result_format: 'message',
          incremental_output: true,
          top_p: 0.8,
          temperature: 0.7,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        responseType: 'stream',
      },
    );

    return res.data;
  }

  async rewriteQuery(
    history: Array<{ role: string; content: string }>,
    query: string,
  ): Promise<string> {
    const prompt = `根据对话历史和当前问题，生成一个独立且完整的检索查询。\n对话历史：${JSON.stringify(history)}\n当前问题：${query}\n查询：`;
    return this.chat([{ role: 'user', content: prompt }], 'qwen-turbo');
  }
}
