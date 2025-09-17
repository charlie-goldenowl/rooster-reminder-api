import { Injectable, Logger } from '@nestjs/common';
import { INotificationChannel } from '../../../common/interfaces/notification-channel.interface';

@Injectable()
export class EmailChannel implements INotificationChannel {
  private readonly logger = new Logger(EmailChannel.name);

  getChannelType(): string {
    return 'email';
  }

  async sendMessage(message: string, recipient: any): Promise<boolean> {
    // TODO: Implement email sending logic
    this.logger.log(`Email channel not implemented yet: ${message}`);
    return false;
  }
}
