import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventLog } from './entities/event-log.entity';
import { User } from '../user/entities/user.entity';
import { EventType } from '../../common/enums/event-type.enum';
import { NotificationStatus } from '../../common/enums/notification-status.enum';
import { IEventProcessor } from '../../common/interfaces/event-processor.interface';
import { TimezoneUtil } from '../../common/utils/timezone.util';

@Injectable()
export class EventService {
  private readonly logger = new Logger(EventService.name);
  private readonly processors = new Map<string, IEventProcessor>();

  constructor(
    @InjectRepository(EventLog)
    private readonly eventLogRepository: Repository<EventLog>,
    @Inject('EVENT_PROCESSORS')
    private readonly eventProcessors: IEventProcessor[],
  ) {
    // Register all processors
    this.eventProcessors.forEach((processor) => {
      this.processors.set(processor.getEventType(), processor);
    });

    this.logger.log(
      `Registered ${this.processors.size} event processors: ${Array.from(
        this.processors.keys(),
      ).join(', ')}`,
    );
  }

  /**
   * Process events for users in a specific timezone
   */
  async processEventsForTimezone(
    timezone: string,
    users: User[],
  ): Promise<EventLog[]> {
    const currentYear = TimezoneUtil.getCurrentYear(timezone);
    const createdEvents: EventLog[] = [];

    for (const user of users) {
      for (const [eventType, processor] of this.processors) {
        if (processor.shouldTrigger(user)) {
          try {
            const eventLog = await this.createEventLog(
              user.id,
              eventType as EventType,
              currentYear,
              {
                timezone,
                message: processor.buildMessage(user),
              },
            );
            createdEvents.push(eventLog);
          } catch (error) {
            this.logger.error(
              `Failed to create event log for user ${user.id}, event ${eventType}`,
              error.stack,
            );
          }
        }
      }
    }

    return createdEvents;
  }

  /**
   * Create an event log (idempotent)
   */
  async createEventLog(
    userId: string,
    eventType: EventType,
    eventYear: number,
    metadata?: Record<string, any>,
  ): Promise<EventLog> {
    // Check if event already exists
    const existing = await this.eventLogRepository.findOne({
      where: { userId, eventType, eventYear },
    });

    if (existing) {
      this.logger.debug(
        `Event log already exists: ${userId}-${eventType}-${eventYear}`,
      );
      return existing;
    }

    const eventLog = this.eventLogRepository.create({
      userId,
      eventType,
      eventYear,
      metadata,
      status: NotificationStatus.PENDING,
    });

    const saved = await this.eventLogRepository.save(eventLog);
    this.logger.log(
      `Created event log: ${saved.id} for user ${userId}, event ${eventType}`,
    );

    return saved;
  }

  /**
   * Update event log status
   */
  async updateEventStatus(
    id: string,
    status: NotificationStatus,
    errorMessage?: string,
  ): Promise<void> {
    const updateData: Partial<EventLog> = { status };

    if (status === NotificationStatus.SENT) {
      updateData.sentAt = new Date();
    }

    if (status === NotificationStatus.FAILED) {
      updateData.errorMessage = errorMessage;
    }

    if (status === NotificationStatus.RETRY) {
      await this.eventLogRepository.increment({ id }, 'retryCount', 1);
    }

    await this.eventLogRepository.update(id, updateData);
    this.logger.debug(`Updated event ${id} status to ${status}`);
  }

  /**
   * Get pending events for processing
   */
  async getPendingEvents(limit: number = 100): Promise<EventLog[]> {
    return await this.eventLogRepository.find({
      where: { status: NotificationStatus.PENDING },
      relations: ['user'],
      take: limit,
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Get failed events for retry
   */
  async getFailedEventsForRetry(maxRetries: number = 3): Promise<EventLog[]> {
    return await this.eventLogRepository
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.user', 'user')
      .where('event.status = :status', { status: NotificationStatus.FAILED })
      .andWhere('event.retryCount < :maxRetries', { maxRetries })
      .andWhere('event.updatedAt < :retryAfter', {
        retryAfter: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
      })
      .orderBy('event.createdAt', 'ASC')
      .take(50)
      .getMany();
  }

  /**
   * Get event statistics
   */
  async getEventStats(): Promise<any> {
    const stats = await this.eventLogRepository
      .createQueryBuilder('event')
      .select('event.eventType', 'eventType')
      .addSelect('event.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('event.eventType')
      .addGroupBy('event.status')
      .getRawMany();

    const total = await this.eventLogRepository.count();

    return {
      total,
      byTypeAndStatus: stats,
    };
  }

  /**
   * Get message for event
   */
  getMessageForEvent(eventLog: EventLog): string {
    const processor = this.processors.get(eventLog.eventType);
    if (!processor) {
      throw new Error(
        `No processor found for event type: ${eventLog.eventType}`,
      );
    }

    // Use cached message from metadata if available
    if (eventLog.metadata?.message) {
      return eventLog.metadata.message;
    }

    // Generate message using processor
    return processor.buildMessage(eventLog.user);
  }

  /**
   * Clean up old event logs (older than 1 year)
   */
  async cleanupOldEvents(): Promise<number> {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    const result = await this.eventLogRepository
      .createQueryBuilder()
      .delete()
      .where('createdAt < :date', { date: oneYearAgo })
      .execute();

    this.logger.log(`Cleaned up ${result.affected} old event logs`);
    return result.affected || 0;
  }
}
