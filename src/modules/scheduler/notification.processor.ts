import { Processor, Process } from '@nestjs/bull';
// import { Job } from 'bull';
import type { Job } from 'bull';
import { Injectable, Logger } from '@nestjs/common';
import { EventService } from '../event/event.service';
import { NotificationService } from '../notification/notification.service';
import { NotificationStatus } from '../../common/enums/notification-status.enum';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

interface NotificationJobData {
  eventLogId: string;
}

@Processor('notification')
@Injectable()
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);
  private readonly redis: Redis;

  constructor(
    private readonly eventService: EventService,
    private readonly notificationService: NotificationService,
    private readonly configService: ConfigService,
  ) {
    this.redis = new Redis({
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get('REDIS_PORT', 6379),
    });
  }

  @Process('send-notification')
  async handleSendNotification(job: Job<NotificationJobData>) {
    const { eventLogId } = job.data;
    const lockKey = `notification-lock:${eventLogId}`;

    this.logger.debug(`Processing notification job for event: ${eventLogId}`);

    // Acquire distributed lock to prevent duplicate processing
    const lock = await this.redis.set(
      lockKey,
      '1',
      'PX',
      30000, // 30 seconds TTL
      'NX', // Only set if not exists
    );

    if (!lock) {
      this.logger.warn(
        `Notification job already processing for event: ${eventLogId}`,
      );
      return;
    }

    try {
      // Get event log with user data
      const eventLog = await this.eventService.getPendingEvents(1);
      const targetEvent = eventLog.find((e) => e.id === eventLogId);

      if (!targetEvent) {
        this.logger.warn(`Event log not found or not pending: ${eventLogId}`);
        return;
      }

      if (targetEvent.status !== NotificationStatus.PENDING) {
        this.logger.warn(
          `Event ${eventLogId} is not in pending status: ${targetEvent.status}`,
        );
        return;
      }

      // Get message for the event
      const message = this.eventService.getMessageForEvent(targetEvent);

      // Send notification
      const success = await this.notificationService.sendEventNotification(
        targetEvent,
        message,
      );

      if (success) {
        await this.eventService.updateEventStatus(
          eventLogId,
          NotificationStatus.SENT,
        );
        this.logger.log(
          `Successfully sent notification for event: ${eventLogId}`,
        );
      } else {
        await this.eventService.updateEventStatus(
          eventLogId,
          NotificationStatus.FAILED,
          'Failed to send notification via webhook',
        );
        this.logger.error(
          `Failed to send notification for event: ${eventLogId}`,
        );

        // Job will be retried automatically by Bull
        throw new Error('Notification sending failed');
      }
    } catch (error) {
      this.logger.error(
        `Error processing notification for event: ${eventLogId}`,
        error.stack,
      );

      await this.eventService.updateEventStatus(
        eventLogId,
        NotificationStatus.FAILED,
        error.message,
      );

      throw error; // Re-throw for Bull retry mechanism
    } finally {
      // Release the lock
      await this.redis.del(lockKey);
    }
  }

  @Process('retry-notification')
  async handleRetryNotification(job: Job<NotificationJobData>) {
    const { eventLogId } = job.data;

    this.logger.log(`Retrying notification for event: ${eventLogId}`);

    // Update status to retry
    await this.eventService.updateEventStatus(
      eventLogId,
      NotificationStatus.RETRY,
    );

    // Queue as regular notification job
    job.queue.add(
      'send-notification',
      { eventLogId },
      {
        attempts: 1, // Single attempt for retry
        removeOnComplete: 5,
        removeOnFail: 3,
      },
    );
  }
}
