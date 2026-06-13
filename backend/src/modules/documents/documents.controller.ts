import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentsService } from './documents.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller()
export class DocumentsController {
  constructor(private documentsService: DocumentsService) {}

  // Hot documents (public + high view count)
  @Get('documents/hot')
  getHotDocuments(@Query() query: { page?: string; limit?: string }) {
    const page = query.page ? Number(query.page) : undefined;
    const limit = query.limit ? Number(query.limit) : undefined;
    return this.documentsService.getHotDocuments({ page, limit });
  }

  // Recent documents (user's recently published)
  @Get('documents/recent')
  @UseGuards(JwtAuthGuard)
  getRecentDocuments(@Query('limit') limit: number, @CurrentUser() user: any) {
    return this.documentsService.getRecentDocuments(user.id, limit ? Number(limit) : 10);
  }

  // Search documents
  @Get('documents/search')
  @UseGuards(JwtAuthGuard)
  searchDocuments(@Query('q') query: string, @Query('limit') limit: number, @CurrentUser() user: any) {
    if (!query) return [];
    return this.documentsService.searchDocuments(query, user.id, limit ? Number(limit) : 20);
  }

  @Get('knowledge-bases/:kbId/documents')
  findByKbId(@Param('kbId') kbId: string, @Query() query: { page?: string; limit?: string }) {
    const page = query.page ? Number(query.page) : undefined;
    const limit = query.limit ? Number(query.limit) : undefined;
    return this.documentsService.findByKbId(kbId, { page, limit });
  }

  @Post('knowledge-bases/:kbId/documents/markdown')
  @UseGuards(JwtAuthGuard)
  createMarkdown(
    @Param('kbId') kbId: string,
    @Body() body: { title: string; content?: string; isPublic?: boolean },
    @CurrentUser() user: any,
  ) {
    return this.documentsService.createMarkdown(kbId, user.id, body);
  }

  @Post('knowledge-bases/:kbId/documents')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  uploadDocument(
    @Param('kbId') kbId: string,
    @UploadedFile() file: any,
    @Body() body: { title?: string },
    @CurrentUser() user: any,
  ) {
    return this.documentsService.upload(kbId, user.id, file, body.title);
  }

  @Get('documents/:id')
  findById(@Param('id') id: string) {
    return this.documentsService.findById(id);
  }

  @Get('documents/:id/content')
  async getContent(@Param('id') id: string) {
    const doc = await this.documentsService.findById(id);
    return { title: doc.title, content: doc.content, type: doc.type, mimeType: doc.mimeType };
  }

  @Put('documents/:id/content')
  @UseGuards(JwtAuthGuard)
  updateContent(@Param('id') id: string, @Body() body: { title?: string; content?: string; isPublic?: boolean }) {
    return this.documentsService.updateContent(id, body);
  }

  @Post('documents/:id/publish')
  @UseGuards(JwtAuthGuard)
  publish(@Param('id') id: string) {
    return this.documentsService.publish(id);
  }

  @Post('documents/:id/reindex')
  @UseGuards(JwtAuthGuard)
  reindex(@Param('id') id: string) {
    return this.documentsService.reindex(id);
  }

  @Delete('documents/:id')
  remove(@Param('id') id: string) {
    return this.documentsService.remove(id);
  }
}
