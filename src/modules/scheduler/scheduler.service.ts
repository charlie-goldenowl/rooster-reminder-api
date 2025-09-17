import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { UserService } from '../user/user.service';
import { EventService } from '../event/event.service';
import { TimezoneUtil } from '../../common/utils/timezone.util';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);
  private readonly birthdayCheckHour: number;
  private readonly retryAttempts: number;
  private readonly retryDelayBase: number;

  constructor(
    private readonly userService: UserService,
    private readonly eventService: EventService,
    private readonly configService: ConfigService,
    @InjectQueue('event-processing') private readonly eventQueue: Queue,
    @InjectQueue('notification') private readonly notificationQueue: Queue,
  ) {
    this.birthdayCheckHour = this.configService.get<number>(
      'BIRTHDAY_CHECK_HOUR',
      9,
    );
    this.retryAttempts = this.configService.get<number>('RETRY_ATTEMPTS', 3);
    this.retryDelayBase = this.configService.get<number>(
      'RETRY_DELAY_BASE',
      60000,
    );
    this.logger.log(
      `Birthday check hour configured: ${this.birthdayCheckHour}:00`,
    );
  }

  /**
   * Main scheduler - runs every hour to check for events
   */
  @Cron(CronExpression.EVERY_HOUR)
  async scheduleEvents() {
    this.logger.log('[scheduleEvents] Starting hourly event scheduling');

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
      this.logger.error(
        'Error in hourly event scheduling',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  /**
   * Recovery scheduler - runs every 30 minutes to retry failed events
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async scheduleEventRecovery() {
    this.logger.log('[scheduleEventRecovery] Starting event recovery process');

    try {
      const failedEvents = await this.eventService.getFailedEventsForRetry(
        this.retryAttempts,
      );

      for (const eventLog of failedEvents) {
        await this.notificationQueue.add(
          'retry-notification',
          { eventLogId: eventLog.id },
          {
            delay: this.calculateRetryDelay(eventLog.retryCount),
            attempts: 1,
            removeOnComplete: 10,
            removeOnFail: 5,
          },
        );
      }
    } catch (error) {
      this.logger.error('Error in event recovery process', error.stack);
    }
  }

  /**
   * Cleanup scheduler - runs daily at 2 AM to clean old data
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
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
   * Test cron -  runs every minute
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async testCron() {
    this.logger.log(
      `🔥 TEST CRON - Running every minute: ${new Date().toISOString()}`,
    );
    await Promise.resolve();
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
            attempts: this.retryAttempts,
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
    // Exponential backoff: 2^retryCount * retryDelayBase (1 minute base)
    return Math.pow(2, retryCount) * this.retryDelayBase;
  }

  /**
   * Get scheduler statistics
   */
  // async getStats() {
  //   const eventQueueStats = await this.eventQueue.getJobCounts();
  //   const notificationQueueStats = await this.notificationQueue.getJobCounts();
  //   const eventStats = await this.eventService.getEventStats();
  //
  //   return {
  //     queues: {
  //       events: eventQueueStats,
  //       notifications: notificationQueueStats,
  //     },
  //     events: eventStats,
  //     lastRun: new Date().toISOString(),
  //   };
  // }
}
