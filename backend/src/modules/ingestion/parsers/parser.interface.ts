/**
 * 文件解析器接口定义
 * 所有解析器必须实现此接口
 */
export interface ParsedSection {
  type: 'heading' | 'paragraph' | 'code' | 'table' | 'list';
  content: string;
  level?: number;     // heading 层级 (1-6)
  language?: string;  // code 的语言
}

export interface ParsedContent {
  text: string;                       // 提取的纯文本
  sections?: ParsedSection[];         // 结构化分段（用于结构化分块）
  metadata?: Record<string, any>;     // 文档元数据（页数、作者等）
}

export interface DocumentParser {
  supportedMimeTypes: string[];
  parse(filePath: string, buffer?: Buffer): Promise<ParsedContent>;
}
