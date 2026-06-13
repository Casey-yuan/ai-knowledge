import { Injectable } from '@nestjs/common';
import { ChunkingStrategy, ChunkOptions, ChunkResult } from './chunking-strategy.interface';
import { ParsedContent, ParsedSection } from '../../ingestion/parsers/parser.interface';

@Injectable()
export class StructureStrategy implements ChunkingStrategy {
  name = 'structure';

  chunk(content: ParsedContent, options: ChunkOptions): ChunkResult[] {
    const { chunkSize, overlap } = options;
    const sections = content.sections || [];

    if (sections.length === 0) {
      // 无结构化信息，降级为递归分割
      return this.fallbackChunk(content.text, options);
    }

    const results: ChunkResult[] = [];
    let currentParentIndex: number | undefined = undefined;
    let offset = 0;

    for (const section of sections) {
      // heading 作为父块
      if (section.type === 'heading') {
        currentParentIndex = results.length;
        results.push({
          content: section.content,
          type: 'heading',
          level: 0,
          startOffset: offset,
          endOffset: offset + section.content.length,
        });
        offset += section.content.length + 2; // +2 for newline
        continue;
      }

      // 代码块和表格保持完整
      if (section.type === 'code' || section.type === 'table') {
        results.push({
          content: section.content,
          type: section.type,
          level: 1,
          parentIndex: currentParentIndex,
          startOffset: offset,
          endOffset: offset + section.content.length,
        });
        offset += section.content.length + 2;
        continue;
      }

      // 普通段落：如果太长则进一步分割
      if (section.content.length <= chunkSize) {
        results.push({
          content: section.content,
          type: section.type,
          level: 1,
          parentIndex: currentParentIndex,
          startOffset: offset,
          endOffset: offset + section.content.length,
        });
        offset += section.content.length + 2;
      } else {
        // 长段落按句子分割
        const subChunks = this.splitLongParagraph(section.content, chunkSize, overlap);
        for (const sub of subChunks) {
          results.push({
            content: sub,
            type: section.type,
            level: 1,
            parentIndex: currentParentIndex,
            startOffset: offset,
            endOffset: offset + sub.length,
          });
          offset += sub.length;
        }
        offset += 2;
      }
    }

    return results;
  }

  private splitLongParagraph(text: string, chunkSize: number, overlap: number): string[] {
    const sentences = text.split(/([。！？.!?\n])/);
    const chunks: string[] = [];
    let current = '';

    for (let i = 0; i < sentences.length; i += 2) {
      const sentence = sentences[i] + (sentences[i + 1] || '');
      if (current.length + sentence.length > chunkSize && current.length > 0) {
        chunks.push(current.trim());
        const overlapText = current.slice(-overlap);
        current = overlapText + sentence;
      } else {
        current += sentence;
      }
    }
    if (current.trim().length > 0) {
      chunks.push(current.trim());
    }
    return chunks;
  }

  private fallbackChunk(text: string, options: ChunkOptions): ChunkResult[] {
    const results: ChunkResult[] = [];
    const separators = ['\n\n', '\n', '。', '.', ' '];
    let start = 0;

    while (start < text.length) {
      let end = Math.min(start + options.chunkSize, text.length);
      if (end < text.length) {
        let found = -1;
        for (const sep of separators) {
          const idx = text.lastIndexOf(sep, end);
          if (idx > start && idx + sep.length > found) found = idx + sep.length;
        }
        if (found > 0) end = found;
      }
      const chunk = text.slice(start, end).trim();
      if (chunk) {
        results.push({ content: chunk, type: 'text', level: 0, startOffset: start, endOffset: end });
      }
      start = end - options.overlap;
      if (start >= text.length) break;
      if (results.length > 1 && start <= results[results.length - 1]?.startOffset) start = end;
    }
    return results;
  }
}
