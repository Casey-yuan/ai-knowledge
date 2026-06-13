import { Injectable } from '@nestjs/common';
import { DocumentParser, ParsedContent, ParsedSection } from './parser.interface';
import * as fs from 'fs';

@Injectable()
export class TextParser implements DocumentParser {
  supportedMimeTypes = [
    'text/plain',
    'text/markdown',
    'application/markdown',
    'text/x-markdown',
  ];

  async parse(filePath: string, buffer?: Buffer): Promise<ParsedContent> {
    const content = buffer
      ? buffer.toString('utf-8')
      : fs.readFileSync(filePath, 'utf-8');

    // 按段落分割为 sections
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    const sections: ParsedSection[] = paragraphs.map(p => {
      const trimmed = p.trim();
      // 检测 Markdown 标题
      const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)/);
      if (headingMatch) {
        return {
          type: 'heading' as const,
          content: headingMatch[2],
          level: headingMatch[1].length,
        };
      }
      // 检测代码块
      if (trimmed.startsWith('```')) {
        const langMatch = trimmed.match(/^```(\w+)/);
        return {
          type: 'code' as const,
          content: trimmed.replace(/^```\w*\n?/, '').replace(/\n?```$/, ''),
          language: langMatch?.[1],
        };
      }
      return { type: 'paragraph' as const, content: trimmed };
    });

    return { text: content, sections };
  }
}
