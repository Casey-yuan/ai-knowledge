import { Injectable } from '@nestjs/common';
import { ChunkingStrategy, ChunkOptions, ChunkResult } from './chunking-strategy.interface';
import { ParsedContent } from '../../ingestion/parsers/parser.interface';

@Injectable()
export class RecursiveStrategy implements ChunkingStrategy {
  name = 'recursive';

  chunk(content: ParsedContent, options: ChunkOptions): ChunkResult[] {
    const { chunkSize, overlap } = options;
    const text = content.text;
    const separators = ['\n\n', '\n', '。', '.', '!', '？', '?', ';', '，', ',', ' '];

    const results: ChunkResult[] = [];
    let start = 0;
    let index = 0;

    while (start < text.length) {
      let end = Math.min(start + chunkSize, text.length);

      // 尝试在自然边界处切断
      if (end < text.length) {
        let found = -1;
        for (const sep of separators) {
          const idx = text.lastIndexOf(sep, end);
          if (idx > start && idx + sep.length > found) {
            found = idx + sep.length;
          }
        }
        if (found > 0 && found > start) end = found;
      }

      const chunkText = text.slice(start, end).trim();
      if (chunkText.length > 0) {
        results.push({
          content: chunkText,
          type: 'text',
          level: 0,
          startOffset: start,
          endOffset: end,
        });
        index++;
      }

      start = end - overlap;
      if (start >= text.length) break;
      // 防止无限循环
      if (start <= results[results.length - 1]?.startOffset && results.length > 1) {
        start = end;
      }
    }

    return results;
  }
}
