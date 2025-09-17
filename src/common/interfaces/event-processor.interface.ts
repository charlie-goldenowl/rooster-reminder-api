import { User } from '../../modules/user/entities/user.entity';

export interface IEventProcessor {
  getEventType(): string;
  shouldTrigger(user: User): boolean;
  buildMessage(user: User): string;
  getScheduleTime(): string; // Cron expression or time
}
