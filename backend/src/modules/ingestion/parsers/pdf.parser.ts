import { Injectable } from '@nestjs/common';
import { DocumentParser, ParsedContent, ParsedSection } from './parser.interface';
import * as fs from 'fs';

@Injectable()
export class PdfParser implements DocumentParser {
  supportedMimeTypes = ['application/pdf'];

  async parse(filePath: string, buffer?: Buffer): Promise<ParsedContent> {
    // pdf-parse 已在 package.json 中安装
    const pdfParse = require('pdf-parse');
    const data = buffer
      ? await pdfParse(buffer)
      : await pdfParse(fs.readFileSync(filePath));

    const text: string = data.text || '';
    const pageCount: number = data.numpages || 0;

    // 按页或双换行拆分为 sections
    const pageTexts = text.split(/\f/).filter((p: string) => p.trim().length > 0);
    const sections: ParsedSection[] = [];

    for (const pageText of pageTexts) {
      const paragraphs = pageText.split(/\n\s*\n/).filter(p => p.trim().length > 0);
      for (const p of paragraphs) {
        sections.push({ type: 'paragraph', content: p.trim() });
      }
    }

    return {
      text,
      sections,
      metadata: { pageCount, info: data.info },
    };
  }
}
