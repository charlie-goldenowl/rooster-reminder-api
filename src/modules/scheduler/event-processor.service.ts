import { Injectable, Logger } from '@nestjs/common';
import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { UserService } from '../user/user.service';
import { EventService } from '../event/event.service';

interface EventJobData {
  timezone: string;
  userIds?: string[];
}

@Processor('event-processing')
@Injectable()
export class EventProcessorService {
  private readonly logger = new Logger(EventProcessorService.name);

  constructor(
    private readonly userService: UserService,
    private readonly eventService: EventService,
  ) {}

  @Process('process-timezone-events')
  async handleTimezoneEvents(job: Job<EventJobData>) {
    const { timezone, userIds } = job.data;

    this.logger.debug(`Processing events for timezone: ${timezone}`);

    try {
      let users;
      if (userIds && userIds.length > 0) {
        // Process specific users
        users = await Promise.all(
          userIds.map((id) => this.userService.findOne(id)),
        );
      } else {
        // Process all users in timezone
        users = await this.userService.findBirthdayUsersInTimezone(timezone);
      }

      if (users.length === 0) {
        this.logger.debug(`No users to process for timezone: ${timezone}`);
        return;
      }

      const eventLogs = await this.eventService.processEventsForTimezone(
        timezone,
        users,
      );

      this.logger.log(
        `Processed ${eventLogs.length} events for ${users.length} users in timezone: ${timezone}`,
      );

      return {
        timezone,
        usersProcessed: users.length,
        eventsCreated: eventLogs.length,
      };
    } catch (error) {
      this.logger.error(
        `Error processing events for timezone: ${timezone}`,
        error.stack,
      );
      throw error;
    }
  }
}
