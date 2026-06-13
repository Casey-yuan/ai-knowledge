import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Res } from '@nestjs/common';
import { Response } from 'express';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateConversationDto, SendMessageDto, FeedbackDto, UpdateConversationDto } from './dto/chat.dto';

@Controller()
export class ChatController {
  constructor(private chatService: ChatService) {}

  @Get('conversations')
  @UseGuards(JwtAuthGuard)
  getConversations(@Query('kbId') kbId: string, @CurrentUser() user: any) {
    return this.chatService.getConversations(user.id, kbId);
  }

  @Get('conversations/:id')
  @UseGuards(JwtAuthGuard)
  getConversation(@Param('id') id: string) {
    return this.chatService.getConversation(id);
  }

  @Post('conversations')
  @UseGuards(JwtAuthGuard)
  createConversation(
    @Body() body: CreateConversationDto,
    @CurrentUser() user: any,
  ) {
    return this.chatService.createConversation(body.kbId, user.id, body.title);
  }

  @Patch('conversations/:id')
  @UseGuards(JwtAuthGuard)
  updateConversation(
    @Param('id') id: string,
    @Body() body: UpdateConversationDto,
  ) {
    return this.chatService.updateConversation(id, body);
  }

  @Delete('conversations/:id')
  @UseGuards(JwtAuthGuard)
  deleteConversation(@Param('id') id: string) {
    return this.chatService.deleteConversation(id);
  }

  @Get('conversations/:id/messages')
  @UseGuards(JwtAuthGuard)
  getMessages(@Param('id') id: string) {
    return this.chatService.getMessages(id);
  }

  @Post('conversations/:id/messages')
  @UseGuards(JwtAuthGuard)
  sendMessage(@Param('id') id: string, @Body() body: SendMessageDto, @CurrentUser() user: any) {
    return this.chatService.sendMessage(id, body.content, user.id, body.kbId);
  }

  @Post('conversations/:id/messages/stream')
  @UseGuards(JwtAuthGuard)
  async sendMessageStream(
    @Param('id') id: string,
    @Body() body: SendMessageDto,
    @Res() res: Response,
    @CurrentUser() user: any,
  ) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    await this.chatService.sendMessageStream(id, body.content, user.id, res, body.kbId);
  }

  @Post('messages/:id/feedback')
  @UseGuards(JwtAuthGuard)
  feedback(@Param('id') id: string, @Body() body: FeedbackDto) {
    return this.chatService.feedback(id, body.feedback);
  }
}
