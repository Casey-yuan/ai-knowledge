import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import axios from 'axios';
import * as crypto from 'crypto';

interface SmsConfig {
  enabled: boolean;
  accessKeyId: string;
  accessKeySecret: string;
  signName: string;
  templateCode: string;
}

@Injectable()
export class SmsService {
  constructor(private prisma: PrismaService) {}

  /** Read SMS config from SystemSetting table */
  private async getSmsConfig(): Promise<SmsConfig> {
    const keys = [
      'sms.enabled',
      'sms.accessKeyId',
      'sms.accessKeySecret',
      'sms.signName',
      'sms.templateCode',
    ];
    const rows = await this.prisma.systemSetting.findMany({
      where: { key: { in: keys } },
    });
    const map = new Map(rows.map((r) => [r.key, r.value]));

    return {
      enabled: (map.get('sms.enabled') as boolean) ?? false,
      accessKeyId: (map.get('sms.accessKeyId') as string) || '',
      accessKeySecret: (map.get('sms.accessKeySecret') as string) || '',
      signName: (map.get('sms.signName') as string) || '',
      templateCode: (map.get('sms.templateCode') as string) || '',
    };
  }

  async sendCode(phone: string): Promise<{ message: string }> {
    // Invalidate old codes
    await this.prisma.verificationCode.updateMany({
      where: { phone, used: false },
      data: { used: true },
    });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await this.prisma.verificationCode.create({
      data: {
        phone,
        code,
        type: 'login',
        expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
      },
    });

    const config = await this.getSmsConfig();

    if (
      config.enabled &&
      config.accessKeyId &&
      config.accessKeySecret &&
      config.signName &&
      config.templateCode
    ) {
      // Send via Aliyun SMS API
      try {
        await this.sendAliyunSms(config, phone, code);
      } catch (err: any) {
        console.error('[SMS] Aliyun SMS send failed:', err.message);
        // Still log the code for development fallback
        console.log(`[SMS-FALLBACK] Code for ${phone}: ${code}`);
      }
    } else {
      // Development mode: log code to console
      console.log(`[SMS-DEV] Code for ${phone}: ${code}`);
    }

    return { message: '验证码已发送' };
  }

  async verifyCode(phone: string, code: string): Promise<boolean> {
    const record = await this.prisma.verificationCode.findFirst({
      where: {
        phone,
        code,
        used: false,
        expiresAt: { gte: new Date() },
      },
    });
    if (!record) return false;

    await this.prisma.verificationCode.update({
      where: { id: record.id },
      data: { used: true },
    });
    return true;
  }

  /**
   * Send SMS via Aliyun SMS API (signature v1)
   * Reference: https://help.aliyun.com/document_detail/101414.html
   */
  private async sendAliyunSms(
    config: SmsConfig,
    phone: string,
    code: string,
  ): Promise<void> {
    const params: Record<string, string> = {
      AccessKeyId: config.accessKeyId,
      Action: 'SendSms',
      Format: 'JSON',
      PhoneNumbers: phone,
      RegionId: 'cn-hangzhou',
      SignName: config.signName,
      SignatureMethod: 'HMAC-SHA1',
      SignatureNonce: crypto.randomUUID(),
      SignatureVersion: '1.0',
      TemplateCode: config.templateCode,
      TemplateParam: JSON.stringify({ code }),
      Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
      Version: '2017-05-25',
    };

    // Build sorted query string for signing
    const sortedKeys = Object.keys(params).sort();
    const canonicalQuery = sortedKeys
      .map(
        (k) =>
          `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`,
      )
      .join('&');

    const stringToSign = `GET&${encodeURIComponent('/')}&${encodeURIComponent(canonicalQuery)}`;
    const signingKey = config.accessKeySecret + '&';
    const signature = crypto
      .createHmac('sha1', signingKey)
      .update(stringToSign)
      .digest('base64');

    const url = `http://dysmsapi.aliyuncs.com/?Signature=${encodeURIComponent(signature)}&${canonicalQuery}`;

    const res = await axios.get(url, { timeout: 10000 });
    const data = res.data;

    if (data.Code !== 'OK') {
      throw new Error(
        `Aliyun SMS error: ${data.Code} - ${data.Message || 'unknown'}`,
      );
    }
  }
}
