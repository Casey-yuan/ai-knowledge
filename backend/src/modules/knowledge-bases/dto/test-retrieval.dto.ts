import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, Max } from 'class-validator';

export class TestRetrievalDto {
  @IsString()
  @IsNotEmpty({ message: '查询内容不能为空' })
  query: string;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(50)
  topK?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(1)
  threshold?: number;

  @IsString()
  @IsOptional()
  mode?: string;
}
