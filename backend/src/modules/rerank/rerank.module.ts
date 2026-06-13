import { Module } from '@nestjs/common';
import { RerankService } from './rerank.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [RerankService],
  exports: [RerankService],
})
export class RerankModule {}
