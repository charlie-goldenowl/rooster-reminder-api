import { DateTime } from 'luxon';

export class TimezoneUtil {
  /**
   * Get timezones at target hour from user data (dynamic)
   */
  static getTimezonesAtHourFromUsers(
    targetHour: number,
    userTimezones: string[],
  ): string[] {
    const now = DateTime.now();

    return userTimezones.filter((tz) => {
      try {
        const localTime = now.setZone(tz);
        return localTime.hour === targetHour;
      } catch (error: unknown) {
        // Invalid timezone, skip
        if (error instanceof Error) {
          console.error(`Error processing timezone: ${error.message}`);
        }
        return false;
      }
    });
  }

  /**
   * Check if it's the user's birthday today in their timezone
   */
  static isBirthdayToday(birthday: Date | string, timezone: string): boolean {
    console.log(
      `[DEBUG] birthday type: ${typeof birthday}, value: ${birthday.toString()}, isDate: ${birthday instanceof Date}`,
    );

    if (!birthday) return false;

    const birthDate =
      typeof birthday === 'string'
        ? DateTime.fromISO(birthday)
        : DateTime.fromJSDate(birthday);

    if (!birthDate.isValid) return false;

    const userNow = DateTime.now().setZone(timezone);
    if (!userNow.isValid) return false;

    const isMatch =
      userNow.month === birthDate.month && userNow.day === birthDate.day;

    console.log(
      `[isBirthdayToday] userNow: ${userNow.toFormat('MM-dd')}, birthDate: ${birthDate.toFormat('MM-dd')}, match: ${isMatch}`,
    );

    return isMatch;
  }

  /**
   * Get current year in user's timezone
   */
  static getCurrentYear(timezone: string): number {
    return DateTime.now().setZone(timezone).year;
  }
}
