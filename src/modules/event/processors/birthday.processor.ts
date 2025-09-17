import { Injectable } from '@nestjs/common';
import { IEventProcessor } from '../../../common/interfaces/event-processor.interface';
import { User } from '../../user/entities/user.entity';
import { EventType } from '../../../common/enums/event-type.enum';
import { TimezoneUtil } from '../../../common/utils/timezone.util';

@Injectable()
export class BirthdayProcessor implements IEventProcessor {
  getEventType(): string {
    return EventType.BIRTHDAY;
  }

  shouldTrigger(user: User): boolean {
    return TimezoneUtil.isBirthdayToday(user.birthday, user.timezone);
  }

  buildMessage(user: User): string {
    return `Hey, ${user.fullName} it's your birthday`;
  }

  getScheduleTime(): string {
    return '0 9 * * *'; // Daily at 9 AM
  }
}
