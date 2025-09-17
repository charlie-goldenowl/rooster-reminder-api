import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { UserService } from '../user/user.service';
import { EventService } from '../event/event.service';
import { TimezoneUtil } from '../../common/utils/timezone.util';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly userService: UserService,
    private readonly eventService: EventService,
    @InjectQueue('event-processing') private readonly eventQueue: Queue,
    @InjectQueue('notification') private readonly notificationQueue: Queue,
  ) {}

  /**
   * Main scheduler - runs every hour to check for events
   */
  @Cron(CronExpression.EVERY_HOUR)
  async scheduleEvents() {
    this.logger.log('Starting hourly event scheduling');

    try {
      // Get all timezones where it's currently 9 AM
      const targetTimezones = TimezoneUtil.getTimezonesAtHour(9);

      this.logger.log(
        `Found ${targetTimezones.length} timezones at 9 AM: ${targetTimezones.join(', ')}`,
      );

      for (const timezone of targetTimezones) {
        await this.processTimezone(timezone);
      }

      this.logger.log('Completed hourly event scheduling');
    } catch (error) {
      this.logger.error('Error in hourly event scheduling', error.stack);
    }
  }

  /**
   * Recovery scheduler - runs every 30 minutes to retry failed events
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async scheduleEventRecovery() {
    this.logger.log('Starting event recovery process');

    try {
      const failedEvents = await this.eventService.getFailedEventsForRetry();

      this.logger.log(`Found ${failedEvents.length} events to retry`);

      for (const eventLog of failedEvents) {
        await this.notificationQueue.add(
          'retry-notification',
          { eventLogId: eventLog.id },
          {
            delay: this.calculateRetryDelay(eventLog.retryCount),
            attempts: 1, // Single attempt per retry job
            removeOnComplete: 10,
            removeOnFail: 5,
          },
        );
      }

      this.logger.log('Completed event recovery scheduling');
    } catch (error) {
      this.logger.error('Error in event recovery process', error.stack);
    }
  }

  /**
   * Cleanup scheduler - runs daily at 2 AM to clean old data
   */
  @Cron('0 2 * * *')
  async scheduleCleanup() {
    this.logger.log('Starting daily cleanup process');

    try {
      const cleaned = await this.eventService.cleanupOldEvents();
      this.logger.log(`Cleanup completed: removed ${cleaned} old event logs`);
    } catch (error) {
      this.logger.error('Error in cleanup process', error.stack);
    }
  }

  /**
   * Process events for a specific timezone
   */
  private async processTimezone(timezone: string): Promise<void> {
    try {
      // Find users with birthdays today in this timezone
      const birthdayUsers =
        await this.userService.findBirthdayUsersInTimezone(timezone);

      if (birthdayUsers.length === 0) {
        this.logger.debug(`No birthday users found for timezone: ${timezone}`);
        return;
      }

      this.logger.log(
        `Found ${birthdayUsers.length} birthday users in ${timezone}`,
      );

      // Create event logs for all applicable events
      const eventLogs = await this.eventService.processEventsForTimezone(
        timezone,
        birthdayUsers,
      );

      // Queue notification jobs for each event
      for (const eventLog of eventLogs) {
        await this.notificationQueue.add(
          'send-notification',
          { eventLogId: eventLog.id },
          {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
            removeOnComplete: 100,
            removeOnFail: 20,
          },
        );
      }

      this.logger.log(
        `Queued ${eventLogs.length} notification jobs for timezone: ${timezone}`,
      );
    } catch (error) {
      this.logger.error(`Error processing timezone ${timezone}`, error.stack);
    }
  }

  /**
   * Calculate exponential backoff delay for retries
   */
  private calculateRetryDelay(retryCount: number): number {
    // Exponential backoff: 2^retryCount * 60000 (1 minute base)
    return Math.pow(2, retryCount) * 60000;
  }

  /**
   * Get scheduler statistics
   */
  async getStats() {
    const eventQueueStats = await this.eventQueue.getJobCounts();
    const notificationQueueStats = await this.notificationQueue.getJobCounts();
    const eventStats = await this.eventService.getEventStats();

    return {
      queues: {
        events: eventQueueStats,
        notifications: notificationQueueStats,
      },
      events: eventStats,
      lastRun: new Date().toISOString(),
    };
  }
}
