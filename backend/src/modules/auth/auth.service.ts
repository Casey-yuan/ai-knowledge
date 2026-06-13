import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async validateUser(username: string, password: string): Promise<any> {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { phone: username },
          { email: username },
        ],
      },
      include: { roles: { include: { role: true } } },
    });

    if (!user || !user.passwordHash) throw new UnauthorizedException('账号或密码错误');
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('账号或密码错误');
    return user;
  }

  async login(user: any) {
    const payload = { sub: user.id, phone: user.phone };
    return {
      accessToken: this.jwtService.sign(payload),
      user: this.sanitizeUser(user),
    };
  }

  async phoneLogin(phone: string) {
    let user = await this.prisma.user.findUnique({ where: { phone } });
    if (!user) {
      user = await this.prisma.user.create({
        data: { phone, nickname: `用户${phone.slice(-4)}` },
      });
    }
    const payload = { sub: user.id, phone: user.phone };
    return {
      accessToken: this.jwtService.sign(payload),
      user: this.sanitizeUser(user),
    };
  }

  sanitizeUser(user: any) {
    const { passwordHash, ...rest } = user;
    return rest;
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });
    if (!user) throw new UnauthorizedException('用户不存在');
    return this.sanitizeUser(user);
  }

  async bindPhone(userId: string, phone: string) {
    // Check if phone is already used by another user
    const existing = await this.prisma.user.findUnique({ where: { phone } });
    if (existing && existing.id !== userId) {
      throw new Error('该手机号已被其他账号绑定');
    }
    return this.prisma.user.update({
      where: { id: userId },
      data: { phone },
    });
  }
}
