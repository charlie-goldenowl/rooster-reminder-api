import { DateTime } from 'luxon';

export class TimezoneUtil {
  /**
   * Get all timezones where it's currently the specified hour
   */
  static getTimezonesAtHour(targetHour: number): string[] {
    const now = DateTime.now();
    const timezones = [
      'America/New_York',
      'America/Los_Angeles',
      'Europe/London',
      'Europe/Paris',
      'Asia/Tokyo',
      'Asia/Shanghai',
      'Australia/Sydney',
      'Australia/Melbourne',
      // Add more as needed
    ];

    return timezones.filter((tz) => {
      const localTime = now.setZone(tz);
      return localTime.hour === targetHour;
    });
  }

  /**
   * Check if it's the user's birthday today in their timezone
   */
  static isBirthdayToday(birthday: Date, timezone: string): boolean {
    const userNow = DateTime.now().setZone(timezone);
    const birthDate = DateTime.fromJSDate(birthday);

    return userNow.month === birthDate.month && userNow.day === birthDate.day;
  }

  /**
   * Get current year in user's timezone
   */
  static getCurrentYear(timezone: string): number {
    return DateTime.now().setZone(timezone).year;
  }
}
