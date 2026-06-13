import { Module } from '@nestjs/common';
import { ChunkingService } from './chunking.service';
import { RecursiveStrategy } from './strategies/recursive.strategy';
import { StructureStrategy } from './strategies/structure.strategy';

@Module({
  providers: [ChunkingService, RecursiveStrategy, StructureStrategy],
  exports: [ChunkingService],
})
export class ChunkingModule {}
