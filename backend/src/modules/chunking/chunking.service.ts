import { Injectable } from '@nestjs/common';
import { RecursiveStrategy } from './strategies/recursive.strategy';
import { StructureStrategy } from './strategies/structure.strategy';
import { ChunkingStrategy, ChunkOptions, ChunkResult } from './strategies/chunking-strategy.interface';
import { ParsedContent } from '../ingestion/parsers/parser.interface';

@Injectable()
export class ChunkingService {
  private strategies = new Map<string, ChunkingStrategy>();

  constructor(
    private recursiveStrategy: RecursiveStrategy,
    private structureStrategy: StructureStrategy,
  ) {
    this.strategies.set('recursive', recursiveStrategy);
    this.strategies.set('structure', structureStrategy);
  }

  getStrategy(name: string): ChunkingStrategy {
    return this.strategies.get(name) || this.recursiveStrategy;
  }

  /**
   * 统一分块入口：根据策略名称和内容执行分块
   */
  chunk(
    content: ParsedContent,
    strategyName: string,
    options: ChunkOptions,
  ): ChunkResult[] {
    const strategy = this.getStrategy(strategyName);
    return strategy.chunk(content, options);
  }

  /**
   * 兼容旧代码：纯文本递归分割
   */
  chunkByRecursiveCharacter(text: string, chunkSize = 500, overlap = 50): string[] {
    const results = this.recursiveStrategy.chunk(
      { text },
      { chunkSize, overlap },
    );
    return results.map(r => r.content);
  }

  chunkByFixedSize(text: string, chunkSize = 500, overlap = 50): string[] {
    const results = this.recursiveStrategy.chunk(
      { text },
      { chunkSize, overlap },
    );
    return results.map(r => r.content);
  }
}
