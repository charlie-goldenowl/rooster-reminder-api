import { Injectable } from '@nestjs/common';
import { IEventProcessor } from '../../../common/interfaces/event-processor.interface';
import { User } from '../../user/entities/user.entity';
import { EventType } from '../../../common/enums/event-type.enum';

@Injectable()
export class AnniversaryProcessor implements IEventProcessor {
  getEventType(): string {
    return EventType.ANNIVERSARY;
  }

  shouldTrigger(user: User): boolean {
    // Example: Check if user has anniversary metadata
    // This could be extended to check custom anniversary dates
    return false; // Placeholder implementation
  }

  buildMessage(user: User): string {
    return `Happy Anniversary, ${user.fullName}!`;
  }

  getScheduleTime(): string {
    return '0 10 * * *'; // Daily at 10 AM
  }
}
