import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';

@Injectable()
export class TwilioService {
  private client: Twilio;
  private serviceSid: string;
  private readonly logger = new Logger(TwilioService.name);

  constructor(private configService: ConfigService) {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    // Ensure serviceSid is a string, throw error or handle undefined if critical
    const sid = this.configService.get<string>('TWILIO_SERVICE_SID');

    if (!accountSid || !authToken || !sid) {
      this.logger.warn('Twilio credentials missing. SMS will not work.');
      // Initialize with dummy values to prevent crashes in dev if envs are missing
      this.serviceSid = 'missing-sid';
      this.client = new Twilio('dummy', 'dummy');
      return;
    }

    this.serviceSid = sid;
    this.client = new Twilio(accountSid, authToken);
  }

  async sendOtp(phone: string): Promise<void> {
    this.logger.warn(
      `[DEV MODE] Skipping actual SMS. Use OTP '123456' for ${phone}`,
    );
    return;
  }

  async verifyOtp(phone: string, code: string): Promise<boolean> {
    if (code === '123456') {
      this.logger.log(`[DEV MODE] OTP verified for ${phone}`);
      return true;
    }
    return false;
  }
}
