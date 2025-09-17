import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { UserModule } from './modules/user/user.module';
import { HealthController } from './common/health/health.controller';
import { DatabaseModule } from './database/database.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { NotificationModule } from './modules/notification/notification.module';
import { EventModule } from './modules/event/event.module';
import { EventModule } from './modules/event/event.module';
import { NotificationModule } from './modules/notification/notification.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './common/controllers/health.controller';
import { UserModule } from './modules/user/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
      },
    }),
    DatabaseModule,
    UserModule,
    EventModule,
    NotificationModule,
    SchedulerModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}