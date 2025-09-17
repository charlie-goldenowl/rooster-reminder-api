import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosResponse, AxiosError } from 'axios';
import { INotificationChannel } from '../../../common/interfaces/notification-channel.interface';
import { EventType } from '../../../common/enums/event-type.enum';

export interface WebhookRecipient {
  userId: string;
  eventType: EventType;
  eventYear: number;
}

export interface WebhookPayload {
  message: string;
  timestamp: string;
  recipient: WebhookRecipient;
}

@Injectable()
export class WebhookChannel implements INotificationChannel {
  private readonly logger = new Logger(WebhookChannel.name);
  private readonly webhookUrl?: string;

  constructor(private readonly configService: ConfigService) {
    this.webhookUrl = this.configService.get<string>('WEBHOOK_URL');
    if (!this.webhookUrl) {
      this.logger.warn(
        'WEBHOOK_URL is not configured. Webhook messages will be skipped.',
      );
    }
  }

  getChannelType(): string {
    return 'webhook';
  }

  async sendMessage(
    message: string,
    recipient: WebhookRecipient,
    timestamp: string = new Date().toISOString(),
  ): Promise<boolean> {
    if (!this.webhookUrl) {
      this.logger.debug(
        `Skipping webhook send because WEBHOOK_URL is not set. Message: ${message}`,
      );
      return false;
    }

    try {
      this.logger.debug(`Sending webhook message: ${message}`);

      const fullUrl = `${this.webhookUrl}/rooster-message`;

      const payload: WebhookPayload = {
        message,
        timestamp,
        recipient,
      };

      const response: AxiosResponse = await axios.post(fullUrl, payload, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Birthday-Reminder-Service/1.0',
        },
      });

      if (response.status >= 200 && response.status < 300) {
        this.logger.log(
          `Webhook message sent successfully to ${fullUrl}: ${message}`,
        );
        return true;
      } else {
        this.logger.error(
          `Webhook returned non-2xx status: ${response.status}`,
        );
        return false;
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        this.logger.error(
          `Failed to send webhook message to ${this.webhookUrl}/rooster-message: ${message}`,
          axiosError.response?.data || axiosError.message,
        );
      } else if (error instanceof Error) {
        this.logger.error(
          `Unexpected error while sending webhook message to ${this.webhookUrl}/rooster-message: ${message}`,
          error.message,
        );
      } else {
        this.logger.error(
          `Unknown error while sending webhook message to ${this.webhookUrl}/rooster-message: ${message}`,
          String(error),
        );
      }
      return false;
    }
  }
}
