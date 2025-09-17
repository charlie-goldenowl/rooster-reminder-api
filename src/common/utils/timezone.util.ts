import { DateTime } from 'luxon';

export class TimezoneUtil {
  /**
   * Get all timezones where it's currently the specified hour
   */
  static getTimezonesAtHour(targetHour: number): string[] {
    const now = DateTime.now();
    const supportedTimezones = this.getSupportedTimezones();

    return supportedTimezones.filter((tz) => {
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

  static isValidTimezone(timezone: string): boolean {
    const supportedTimezones = this.getSupportedTimezones();
    return supportedTimezones.includes(timezone);
  }

  static getDefaultTimezone(): string {
    return process.env.DEFAULT_TIMEZONE || 'UTC';
  }

  static getSupportedTimezones(): string[] {
    const configTimezones = process.env.SUPPORTED_TIMEZONES;

    if (configTimezones) {
      return configTimezones.split(',').map((tz) => tz.trim());
    }

    // Default fallback
    return [
      'UTC',
      'America/New_York',
      'Europe/London',
      'Asia/Tokyo',
      'Australia/Sydney',
    ];
  }
}
