import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventService } from './event.service';
import { EventLog } from './entities/event-log.entity';
import { BirthdayProcessor } from './processors/birthday.processor';
import { AnniversaryProcessor } from './processors/anniversary.processor';

@Module({
  imports: [TypeOrmModule.forFeature([EventLog])],
  providers: [
    EventService,
    BirthdayProcessor,
    AnniversaryProcessor,
    {
      provide: 'EVENT_PROCESSORS',
      useFactory: (
        birthdayProcessor: BirthdayProcessor,
        anniversaryProcessor: AnniversaryProcessor,
      ) => [birthdayProcessor, anniversaryProcessor],
      inject: [BirthdayProcessor, AnniversaryProcessor],
    },
  ],
  exports: [EventService],
})
export class EventModule {}
