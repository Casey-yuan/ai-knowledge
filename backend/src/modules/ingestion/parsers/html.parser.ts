import { Injectable } from '@nestjs/common';
import { DocumentParser, ParsedContent, ParsedSection } from './parser.interface';
import * as fs from 'fs';

@Injectable()
export class HtmlParser implements DocumentParser {
  supportedMimeTypes = [
    'text/html',
    'application/xhtml+xml',
  ];

  async parse(filePath: string, buffer?: Buffer): Promise<ParsedContent> {
    // cheerio 已在 package.json 中安装
    const cheerio = require('cheerio');
    const html = buffer
      ? buffer.toString('utf-8')
      : fs.readFileSync(filePath, 'utf-8');

    const $ = cheerio.load(html);

    // 移除噪声元素
    $('script, style, nav, header, footer, aside, iframe, noscript').remove();

    // 尝试提取正文：优先 main > article > body
    const mainEl = $('main').length
      ? $('main')
      : $('article').length
        ? $('article')
        : $('body');

    const text = mainEl.text().replace(/\s+/g, ' ').trim();

    // 提取结构化 sections
    const sections: ParsedSection[] = [];
    mainEl.children().each((_: number, el: any) => {
      const tagName = (el.tagName || '').toLowerCase();
      const content = $(el).text().trim();
      if (!content) return;

      if (/^h[1-6]$/.test(tagName)) {
        sections.push({
          type: 'heading',
          content,
          level: parseInt(tagName[1]),
        });
      } else if (tagName === 'pre' || tagName === 'code') {
        sections.push({ type: 'code', content });
      } else if (tagName === 'table') {
        sections.push({ type: 'table', content });
      } else if (tagName === 'ul' || tagName === 'ol') {
        sections.push({ type: 'list', content });
      } else {
        sections.push({ type: 'paragraph', content });
      }
    });

    // 提取元数据
    const title = $('title').text().trim() || $('h1').first().text().trim();
    const description = $('meta[name="description"]').attr('content') || '';

    return {
      text,
      sections: sections.length > 0 ? sections : [{ type: 'paragraph', content: text }],
      metadata: { title, description },
    };
  }
}
