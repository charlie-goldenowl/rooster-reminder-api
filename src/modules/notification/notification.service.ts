import { Injectable, Logger, Inject } from '@nestjs/common';
import { INotificationChannel } from '../../common/interfaces/notification-channel.interface';
import { EventLog } from '../event/entities/event-log.entity';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly channels = new Map<string, INotificationChannel>();

  constructor(
    @Inject('NOTIFICATION_CHANNELS')
    private readonly notificationChannels: INotificationChannel[],
  ) {
    // Register all notification channels
    this.notificationChannels.forEach((channel) => {
      this.channels.set(channel.getChannelType(), channel);
    });

    this.logger.log(
      `Registered ${this.channels.size} notification channels: ${Array.from(
        this.channels.keys(),
      ).join(', ')}`,
    );
  }

  /**
   * Send notification using specified channel
   */
  async sendNotification(
    message: string,
    channelType: string = 'webhook',
    recipient?: any,
  ): Promise<boolean> {
    const channel = this.channels.get(channelType);

    if (!channel) {
      this.logger.error(`Notification channel not found: ${channelType}`);
      return false;
    }

    try {
      return await channel.sendMessage(message, recipient);
    } catch (error) {
      this.logger.error(
        `Failed to send notification via ${channelType}`,
        error.stack,
      );
      return false;
    }
  }

  /**
   * Send notification for event log
   */
  async sendEventNotification(
    eventLog: EventLog,
    message: string,
  ): Promise<boolean> {
    const recipient = {
      userId: eventLog.userId,
      eventType: eventLog.eventType,
      eventYear: eventLog.eventYear,
    };

    return await this.sendNotification(message, 'webhook', recipient);
  }

  /**
   * Get available notification channels
   */
  getAvailableChannels(): string[] {
    return Array.from(this.channels.keys());
  }

  /**
   * Test notification channel
   */
  async testChannel(channelType: string): Promise<boolean> {
    const testMessage = `Test message from Birthday Reminder Service - ${new Date().toISOString()}`;
    return await this.sendNotification(testMessage, channelType);
  }
}
