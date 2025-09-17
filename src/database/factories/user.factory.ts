import { User } from '../../modules/user/entities/user.entity';

export interface UserFactoryOptions {
  firstName?: string;
  lastName?: string;
  birthday?: string;
  timezone?: string;
}

export class UserFactory {
  static create(options: UserFactoryOptions = {}): Partial<User> {
    const timezones = [
      'America/New_York',
      'America/Los_Angeles',
      'America/Chicago',
      'Europe/London',
      'Europe/Paris',
      'Asia/Tokyo',
      'Asia/Shanghai',
      'Australia/Sydney',
      'Australia/Melbourne',
    ];

    const firstNames = [
      'John',
      'Jane',
      'Michael',
      'Sarah',
      'David',
      'Emma',
      'Robert',
      'Lisa',
      'James',
      'Maria',
      'William',
      'Jennifer',
      'Richard',
      'Patricia',
      'Charles',
      'Linda',
      'Thomas',
      'Elizabeth',
    ];

    const lastNames = [
      'Smith',
      'Johnson',
      'Williams',
      'Brown',
      'Jones',
      'Garcia',
      'Miller',
      'Davis',
      'Rodriguez',
      'Martinez',
      'Hernandez',
      'Lopez',
      'Gonzalez',
      'Wilson',
      'Anderson',
      'Thomas',
      'Taylor',
      'Moore',
    ];

    return {
      firstName:
        options.firstName ||
        firstNames[Math.floor(Math.random() * firstNames.length)],
      lastName:
        options.lastName ||
        lastNames[Math.floor(Math.random() * lastNames.length)],
      birthday: options.birthday
        ? new Date(options.birthday)
        : this.randomBirthday(),
      timezone:
        options.timezone ||
        timezones[Math.floor(Math.random() * timezones.length)],
    };
  }

  private static randomBirthday(): Date {
    const start = new Date(1970, 0, 1);
    const end = new Date(2005, 11, 31);
    return new Date(
      start.getTime() + Math.random() * (end.getTime() - start.getTime()),
    );
  }

  static createMany(
    count: number,
    options: UserFactoryOptions = {},
  ): Partial<User>[] {
    return Array.from({ length: count }, () => this.create(options));
  }
}
