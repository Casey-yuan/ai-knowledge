import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean, Min, Max } from 'class-validator';

export class CreateKnowledgeBaseDto {
  @IsString()
  @IsNotEmpty({ message: '知识库名称不能为空' })
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(50)
  topK?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(1)
  similarityThreshold?: number;

  @IsBoolean()
  @IsOptional()
  isPublic?: boolean;
}
