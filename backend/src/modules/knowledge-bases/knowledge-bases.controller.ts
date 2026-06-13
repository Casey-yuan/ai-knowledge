import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { KnowledgeBasesService } from './knowledge-bases.service';
import { CreateKnowledgeBaseDto } from './dto/create-kb.dto';
import { TestRetrievalDto } from './dto/test-retrieval.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('knowledge-bases')
export class KnowledgeBasesController {
  constructor(private kbService: KnowledgeBasesService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@Query() query: { page?: string; limit?: string; keyword?: string }, @Req() req: any) {
    const userId = req.user?.sub || req.user?.id;
    const page = query.page ? Number(query.page) : undefined;
    const limit = query.limit ? Number(query.limit) : undefined;
    return this.kbService.findAll({ page, limit, keyword: query.keyword, userId });
  }

  @Get('hot')
  getHotKnowledgeBases(@Query() query: { page?: string; limit?: string }) {
    const page = query.page ? Number(query.page) : undefined;
    const limit = query.limit ? Number(query.limit) : undefined;
    return this.kbService.getHotKnowledgeBases({ page, limit });
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findById(@Param('id') id: string) {
    // Increment view count when viewing KB details
    await this.kbService.incrementViewCount(id);
    return this.kbService.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() body: CreateKnowledgeBaseDto, @Req() req: any) {
    const userId = req.user?.sub || req.user?.id;
    return this.kbService.create({ ...body, createdBy: userId });
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() body: any) {
    return this.kbService.update(id, body);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string) {
    return this.kbService.remove(id);
  }

  @Post(':id/test-retrieval')
  @UseGuards(JwtAuthGuard)
  async testRetrieval(
    @Param('id') id: string,
    @Body() body: TestRetrievalDto,
  ) {
    const topK = body.topK || 5;
    const threshold = body.threshold !== undefined ? body.threshold : 0.3;
    const mode = body.mode || 'hybrid';

    const startTime = Date.now();
    let results: any[];

    if (mode === 'vector') {
      results = await this.kbService.testVectorRetrieval(id, body.query, topK, threshold);
    } else if (mode === 'fulltext') {
      results = await this.kbService.testFullTextRetrieval(id, body.query, topK);
    } else {
      // hybrid: combine vector + fulltext
      results = await this.kbService.testVectorRetrieval(id, body.query, topK, threshold);
    }

    const elapsed = Date.now() - startTime;
    return {
      data: results,
      meta: { elapsed: `${elapsed}ms`, count: results.length, mode },
    };
  }
}
