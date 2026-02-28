import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface Msg91Recipient {
  mobiles: string;
  [key: string]: string; // template variables
}

interface Msg91FlowRequest {
  flow_id: string;
  recipients: Msg91Recipient[];
}

@Injectable()
export class Msg91Service {
  private readonly logger = new Logger(Msg91Service.name);
  private readonly authKey: string;
  private readonly baseUrl: string;
  private readonly configured: boolean;

  constructor(private readonly config: ConfigService) {
    this.authKey = this.config.get('MSG91_AUTH_KEY', '');
    this.baseUrl = this.config.get(
      'MSG91_BASE_URL',
      'https://control.msg91.com/api/v5',
    );

    if (this.authKey) {
      this.configured = true;
      this.logger.log('MSG91 service initialized (LIVE mode)');
    } else {
      this.configured = false;
      this.logger.warn(
        'MSG91_AUTH_KEY not set — running in DEV MODE. OTP 123456 accepted for all phones.',
      );
    }
  }

  isReady(): boolean {
    return this.configured;
  }

  async sendSms(request: Msg91FlowRequest): Promise<{ requestId?: string; success: boolean }> {
    if (!this.configured) {
      this.logger.warn('[DEV MODE] SMS not sent (MSG91 not configured)');
      return { success: true, requestId: `dev_${Date.now()}` };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/flow/`, {
        method: 'POST',
        headers: {
          authkey: this.authKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const error = await response.text();
      this.logger.error(`MSG91 API error: ${response.status} — ${error}`);
      throw new Error(`MSG91 API failed: ${response.status}`);
    }

    const data = await response.json();
    this.logger.log(`SMS sent via MSG91: ${JSON.stringify(data)}`);

    return { success: true, requestId: data.request_id || data.message };
  }

  async sendOtp(
    phone: string,
    otp: string,
    flowId: string,
  ): Promise<string | null> {
    const request: Msg91FlowRequest = {
      flow_id: flowId,
      recipients: [
        {
          mobiles: phone.replace('+', ''),
          OTP: otp,
        },
      ],
    };

    const result = await this.sendSms(request);
    return result.requestId || null;
  }

  async sendWithTemplate(
    flowId: string,
    recipients: Array<{ phone: string; variables: Record<string, string> }>,
  ): Promise<string | null> {
    const request: Msg91FlowRequest = {
      flow_id: flowId,
      recipients: recipients.map((r) => ({
        mobiles: r.phone.replace('+', ''),
        ...r.variables,
      })),
    };

    const result = await this.sendSms(request);
    return result.requestId || null;
  }
}
