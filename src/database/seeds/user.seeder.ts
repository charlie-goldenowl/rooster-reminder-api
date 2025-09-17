import { DataSource } from 'typeorm';
import { BaseSeeder } from './base.seeder';
import { User } from '../../modules/user/entities/user.entity';
import { UserFactory } from '../factories/user.factory';

export class UserSeeder extends BaseSeeder {
  async run(): Promise<void> {
    this.logger.log('🌱 Starting User Seeder...');

    const userRepository = this.dataSource.getRepository(User);

    // Clear existing data
    await userRepository.delete({});
    this.logger.log('🗑️  Cleared existing users');

    // Create test users with birthdays today (for immediate testing)
    const today = new Date();
    const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const testUsers = [
      // Today's birthday users for immediate testing
      UserFactory.create({
        firstName: 'Alice',
        lastName: 'Johnson',
        birthday: todayString,
        timezone: 'America/New_York',
      }),
      UserFactory.create({
        firstName: 'Bob',
        lastName: 'Smith',
        birthday: todayString,
        timezone: 'Europe/London',
      }),
      UserFactory.create({
        firstName: 'Charlie',
        lastName: 'Brown',
        birthday: todayString,
        timezone: 'Asia/Tokyo',
      }),

      // Tomorrow's birthday users
      UserFactory.create({
        firstName: 'Diana',
        lastName: 'Wilson',
        birthday: this.getTomorrowString(),
        timezone: 'America/Los_Angeles',
      }),

      // Users with birthdays in different months
      UserFactory.create({
        firstName: 'Emma',
        lastName: 'Davis',
        birthday: '1990-05-15',
        timezone: 'Australia/Sydney',
      }),
      UserFactory.create({
        firstName: 'Frank',
        lastName: 'Miller',
        birthday: '1985-12-25',
        timezone: 'Europe/Paris',
      }),
    ];

    // Save test users
    const savedTestUsers = await userRepository.save(testUsers);
    this.logger.log(`✅ Created ${savedTestUsers.length} test users`);

    // Create random users for scale testing
    const randomUsers = UserFactory.createMany(20);
    const savedRandomUsers = await userRepository.save(randomUsers);
    this.logger.log(`✅ Created ${savedRandomUsers.length} random users`);

    // Log summary
    this.logger.log('📊 Seeding Summary:');
    this.logger.log(
      `   • Total users: ${savedTestUsers.length + savedRandomUsers.length}`,
    );
    this.logger.log(`   • Today's birthdays: 3 users`);
    this.logger.log(`   • Tomorrow's birthdays: 1 user`);
    this.logger.log(`   • Timezones covered: 8 different zones`);

    this.logger.log('🎉 User Seeder completed successfully!');
  }

  private getTomorrowString(): string {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
  }
}
