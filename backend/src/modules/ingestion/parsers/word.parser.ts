import { Injectable } from '@nestjs/common';
import { DocumentParser, ParsedContent, ParsedSection } from './parser.interface';
import * as fs from 'fs';

@Injectable()
export class WordParser implements DocumentParser {
  supportedMimeTypes = [
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  async parse(filePath: string, buffer?: Buffer): Promise<ParsedContent> {
    // mammoth 已在 package.json 中安装
    const mammoth = require('mammoth');
    const fileBuffer = buffer || fs.readFileSync(filePath);

    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    const text: string = result.value || '';

    // 按段落拆分为 sections
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    const sections: ParsedSection[] = paragraphs.map(p => ({
      type: 'paragraph' as const,
      content: p.trim(),
    }));

    const warnings = result.messages
      ?.filter((m: any) => m.type === 'warning')
      .map((m: any) => m.message);

    return {
      text,
      sections,
      metadata: { warnings: warnings?.slice(0, 10) },
    };
  }
}
