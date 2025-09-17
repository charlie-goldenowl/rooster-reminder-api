import { DataSource } from 'typeorm';
import { Logger } from '@nestjs/common';
import { UserSeeder } from './user.seeder';

export class MainSeeder {
  private readonly logger = new Logger(MainSeeder.name);

  constructor(private readonly dataSource: DataSource) {}

  async run(): Promise<void> {
    this.logger.log('Starting Database Seeding...');

    try {
      // Run seeders in order
      const userSeeder = new UserSeeder(this.dataSource);
      await userSeeder.run();

      this.logger.log('All seeders completed successfully!');
    } catch (error) {
      this.logger.error('Seeding failed:', error);
      throw error;
    }
  }
}
