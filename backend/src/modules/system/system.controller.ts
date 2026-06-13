import { Controller, Get, Put, Body, Query, UseGuards } from '@nestjs/common';
import { SystemService } from './system.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@Controller('system')
@UseGuards(JwtAuthGuard)
export class SystemController {
  constructor(private systemService: SystemService) {}

  @Get('stats')
  getStats() {
    return this.systemService.getStats();
  }

  @Get('audit-logs')
  getAuditLogs(@Query() query: {
    page?: number;
    limit?: number;
    action?: string;
    resource?: string;
    userId?: string;
    dateFrom?: string;
    dateTo?: string;
  }) {
    return this.systemService.getAuditLogs(query);
  }

  @Get('settings')
  getSettings() {
    return this.systemService.getSettings();
  }

  @Put('settings')
  updateSettings(@Body() body: any) {
    return this.systemService.updateSettings(body);
  }
}
