import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosResponse } from 'axios';
import { INotificationChannel } from '../../../common/interfaces/notification-channel.interface';

@Injectable()
export class WebhookChannel implements INotificationChannel {
  private readonly logger = new Logger(WebhookChannel.name);
  private readonly webhookUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.webhookUrl = this.configService.get<string>(
      'WEBHOOK_URL',
      'https://hookbin.com/bin/default',
    );
  }

  getChannelType(): string {
    return 'webhook';
  }

  async sendMessage(message: string, recipient?: any): Promise<boolean> {
    try {
      this.logger.debug(`Sending webhook message: ${message}`);

      const response: AxiosResponse = await axios.post(
        this.webhookUrl,
        {
          message,
          timestamp: new Date().toISOString(),
          recipient,
        },
        {
          timeout: 10000, // 10 seconds timeout
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Birthday-Reminder-Service/1.0',
          },
        },
      );

      if (response.status >= 200 && response.status < 300) {
        this.logger.log(`Webhook message sent successfully: ${message}`);
        return true;
      } else {
        this.logger.error(
          `Webhook returned non-2xx status: ${response.status}`,
        );
        return false;
      }
    } catch (error) {
      this.logger.error(
        `Failed to send webhook message: ${message}`,
        error.message,
      );
      return false;
    }
  }
}
