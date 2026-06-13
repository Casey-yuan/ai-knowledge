import { Injectable } from '@nestjs/common';
import { DocumentParser, ParsedContent } from './parser.interface';
import { TextParser } from './text.parser';
import { PdfParser } from './pdf.parser';
import { WordParser } from './word.parser';
import { HtmlParser } from './html.parser';

@Injectable()
export class ParserRegistry {
  private parsers = new Map<string, DocumentParser>();

  constructor(
    private textParser: TextParser,
    private pdfParser: PdfParser,
    private wordParser: WordParser,
    private htmlParser: HtmlParser,
  ) {
    this.register(textParser);
    this.register(pdfParser);
    this.register(wordParser);
    this.register(htmlParser);
  }

  private register(parser: DocumentParser) {
    for (const mime of parser.supportedMimeTypes) {
      this.parsers.set(mime, parser);
    }
  }

  getParser(mimeType: string): DocumentParser {
    return this.parsers.get(mimeType) || this.textParser;
  }
}
