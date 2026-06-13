import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { RolesModule } from './modules/roles/roles.module';
import { SmsModule } from './modules/sms/sms.module';
import { KnowledgeBasesModule } from './modules/knowledge-bases/knowledge-bases.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { IngestionModule } from './modules/ingestion/ingestion.module';
import { ChunkingModule } from './modules/chunking/chunking.module';
import { EmbeddingModule } from './modules/embedding/embedding.module';
import { LlmModule } from './modules/llm/llm.module';
import { RetrievalModule } from './modules/retrieval/retrieval.module';
import { ChatModule } from './modules/chat/chat.module';
import { SystemModule } from './modules/system/system.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),
    PrismaModule,
    AuthModule,
    UsersModule,
    RolesModule,
    SmsModule,
    KnowledgeBasesModule,
    DocumentsModule,
    IngestionModule,
    ChunkingModule,
    EmbeddingModule,
    LlmModule,
    RetrievalModule,
    ChatModule,
    SystemModule,
  ],
})
export class AppModule {}
