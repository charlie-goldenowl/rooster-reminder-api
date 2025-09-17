import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { SchedulerService } from './scheduler.service';
import { EventProcessorService } from './event-processor.service';
import { NotificationProcessor } from './notification.processor';
import { UserModule } from '../user/user.module';
import { EventModule } from '../event/event.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'event-processing' },
      { name: 'notification' },
    ),
    UserModule,
    EventModule,
    NotificationModule,
  ],
  providers: [SchedulerService, EventProcessorService, NotificationProcessor],
  exports: [SchedulerService],
})
export class SchedulerModule {}
