import { BaseSeeder } from './base.seeder';
import { User } from '../../modules/user/entities/user.entity';
import { UserFactory } from '../factories/user.factory';

export class UserSeeder extends BaseSeeder {
  async run(): Promise<void> {
    const userRepository = this.dataSource.getRepository(User);

    // await userRepository.delete({});
    await userRepository.query(
      `TRUNCATE TABLE "users" RESTART IDENTITY CASCADE`,
    );

    const today = new Date();
    const todayString = `${today.getFullYear()}-${String(
      today.getMonth() + 1,
    ).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const testUsers = [
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
      UserFactory.create({
        firstName: 'Diana',
        lastName: 'Wilson',
        birthday: this.getTomorrowString(),
        timezone: 'America/Los_Angeles',
      }),
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

    await userRepository.save(testUsers);

    const randomUsers = UserFactory.createMany(20);
    await userRepository.save(randomUsers);
  }

  private getTomorrowString(): string {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return `${tomorrow.getFullYear()}-${String(
      tomorrow.getMonth() + 1,
    ).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
  }
}
