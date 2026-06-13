import { ParsedContent } from '../../ingestion/parsers/parser.interface';

export interface ChunkOptions {
  chunkSize: number;
  overlap: number;
}

export interface ChunkResult {
  content: string;
  type: string;         // text, heading, code, table
  level: number;        // 层级
  parentIndex?: number; // 父块在结果数组中的索引
  startOffset: number;
  endOffset: number;
}

export interface ChunkingStrategy {
  name: string;
  chunk(content: ParsedContent, options: ChunkOptions): ChunkResult[];
}
