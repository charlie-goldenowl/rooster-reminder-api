import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';
import { User } from '../modules/user/entities/user.entity';
import { EventLog } from '../modules/event/entities/event-log.entity';

config();

const configService = new ConfigService();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: configService.get('DATABASE_HOST', 'localhost'),
  port: configService.get('DATABASE_PORT', 5432),
  username: configService.get('DATABASE_USERNAME', 'postgres'),
  password: configService.get('DATABASE_PASSWORD', 'password'),
  database: configService.get('DATABASE_NAME', 'rooster_db'),
  entities: [User, EventLog],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
  logging: configService.get('NODE_ENV') === 'development',
});
