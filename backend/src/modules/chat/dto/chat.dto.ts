import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateConversationDto {
  @IsString()
  @IsNotEmpty({ message: '知识库 ID 不能为空' })
  kbId: string;

  @IsString()
  @IsOptional()
  title?: string;
}

export class SendMessageDto {
  @IsString()
  @IsNotEmpty({ message: '消息内容不能为空' })
  content: string;

  @IsString()
  @IsOptional()
  kbId?: string;
}

export class FeedbackDto {
  @IsString()
  @IsNotEmpty()
  feedback: string;
}

export class UpdateConversationDto {
  @IsString()
  @IsOptional()
  title?: string;
}
