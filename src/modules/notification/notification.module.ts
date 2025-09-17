import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { WebhookChannel } from './channels/webhook.channel';
import { EmailChannel } from './channels/email.channel';

@Module({
  providers: [
    NotificationService,
    WebhookChannel,
    EmailChannel,
    {
      provide: 'NOTIFICATION_CHANNELS',
      useFactory: (
        webhookChannel: WebhookChannel,
        emailChannel: EmailChannel,
      ) => [webhookChannel, emailChannel],
      inject: [WebhookChannel, EmailChannel],
    },
  ],
  exports: [NotificationService],
})
export class NotificationModule {}
