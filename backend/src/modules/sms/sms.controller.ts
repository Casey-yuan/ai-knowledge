import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { SmsService } from './sms.service';

@Controller('sms')
export class SmsController {
  constructor(private smsService: SmsService) {}

  @Post('send')
  @HttpCode(HttpStatus.OK)
  async send(@Body() body: { phone: string }) {
    return this.smsService.sendCode(body.phone);
  }
}
