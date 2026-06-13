import { Module } from '@nestjs/common';
import { KnowledgeBasesService } from './knowledge-bases.service';
import { KnowledgeBasesController } from './knowledge-bases.controller';
import { RetrievalModule } from '../retrieval/retrieval.module';

@Module({
  imports: [RetrievalModule],
  controllers: [KnowledgeBasesController],
  providers: [KnowledgeBasesService],
  exports: [KnowledgeBasesService],
})
export class KnowledgeBasesModule {}
