import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { IngestionProcessor } from './ingestion.processor';
import { IngestionService } from './ingestion.service';
import { EmbeddingModule } from '../embedding/embedding.module';
import { ChunkingModule } from '../chunking/chunking.module';
import { ParserRegistry } from './parsers/parser.registry';
import { TextParser } from './parsers/text.parser';
import { PdfParser } from './parsers/pdf.parser';
import { WordParser } from './parsers/word.parser';
import { HtmlParser } from './parsers/html.parser';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'ingestion' }),
    EmbeddingModule,
    ChunkingModule,
  ],
  providers: [
    IngestionProcessor,
    IngestionService,
    ParserRegistry,
    TextParser,
    PdfParser,
    WordParser,
    HtmlParser,
  ],
  exports: [IngestionService],
})
export class IngestionModule {}
