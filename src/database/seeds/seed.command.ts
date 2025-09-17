import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from '../../app.module';
import { DataSource } from 'typeorm';
import { MainSeeder } from './main.seeder';

async function runSeeders() {
  const logger = new Logger('DatabaseSeeder');

  try {
    logger.log('Initializing NestJS application for seeding...');

    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: ['log', 'error', 'warn'],
    });

    const dataSource = app.get(DataSource);

    if (!dataSource.isInitialized) {
      await dataSource.initialize();
      logger.log('Database connection initialized');
    }

    const mainSeeder = new MainSeeder(dataSource);
    await mainSeeder.run();

    await app.close();
    logger.log('Seeding completed successfully!');

    process.exit(0);
  } catch (error) {
    logger.error('Seeding failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  runSeeders();
}
