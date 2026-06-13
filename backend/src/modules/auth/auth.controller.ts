import { Controller, Get, Post, Body, UseGuards, HttpCode, HttpStatus, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SmsService } from '../sms/sms.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { LoginDto, PhoneLoginDto, BindPhoneDto } from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private smsService: SmsService,
  ) {}

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@CurrentUser() user: any) {
    return this.authService.getProfile(user.id || user.sub);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: LoginDto) {
    const user = await this.authService.validateUser(body.username, body.password);
    return this.authService.login(user);
  }

  @Post('phone-login')
  @HttpCode(HttpStatus.OK)
  async phoneLogin(@Body() body: PhoneLoginDto) {
    // Verify SMS code before login
    const valid = await this.smsService.verifyCode(body.phone, body.code);
    if (!valid) {
      throw new BadRequestException('验证码错误或已过期');
    }
    return this.authService.phoneLogin(body.phone);
  }

  @Post('refresh')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async refresh(@CurrentUser() user: any) {
    return { accessToken: user.accessToken || '' };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout() {
    return { message: 'ok' };
  }

  @Post('bind-phone')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async bindPhone(@CurrentUser() user: any, @Body() body: BindPhoneDto) {
    if (!body.phone || !body.code) {
      throw new BadRequestException('手机号和验证码不能为空');
    }
    // Verify SMS code before binding
    const valid = await this.smsService.verifyCode(body.phone, body.code);
    if (!valid) {
      throw new BadRequestException('验证码错误或已过期');
    }
    const updated = await this.authService.bindPhone(user.id || user.sub, body.phone);
    return { message: '绑定成功', user: this.authService.sanitizeUser(updated) };
  }
}
