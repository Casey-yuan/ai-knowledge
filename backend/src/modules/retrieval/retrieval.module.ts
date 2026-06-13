import { Module } from '@nestjs/common';
import { RetrievalService } from './retrieval.service';
import { EmbeddingModule } from '../embedding/embedding.module';
import { ChunkingModule } from '../chunking/chunking.module';

@Module({
  imports: [EmbeddingModule, ChunkingModule],
  providers: [RetrievalService],
  exports: [RetrievalService],
})
export class RetrievalModule {}
