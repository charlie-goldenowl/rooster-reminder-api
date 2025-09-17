import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bull';
import { SchedulerService } from './scheduler.service';
import { UserService } from '../user/user.service';
import { EventService } from '../event/event.service';
import { TimezoneUtil } from '../../common/utils/timezone.util';

// Mock the TimezoneUtil
jest.mock('../../common/utils/timezone.util');
const MockedTimezoneUtil = TimezoneUtil as jest.Mocked<typeof TimezoneUtil>;

describe('SchedulerService - Cron Jobs', () => {
  let service: SchedulerService;
  let userService: jest.Mocked<UserService>;
  let eventService: jest.Mocked<EventService>;
  let configService: jest.Mocked<ConfigService>;
  let notificationQueue: any;

  beforeEach(async () => {
    const mockUserService = {
      findBirthdayUsersInTimezone: jest.fn(),
    };

    const mockEventService = {
      processEventsForTimezone: jest.fn(),
      getFailedEventsForRetry: jest.fn(),
      cleanupOldEvents: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    const mockNotificationQueue = {
      add: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulerService,
        {
          provide: UserService,
          useValue: mockUserService,
        },
        {
          provide: EventService,
          useValue: mockEventService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: getQueueToken('event-processing'),
          useValue: { add: jest.fn() },
        },
        {
          provide: getQueueToken('notification'),
          useValue: mockNotificationQueue,
        },
      ],
    }).compile();

    service = module.get<SchedulerService>(SchedulerService);
    userService = module.get(UserService);
    eventService = module.get(EventService);
    configService = module.get(ConfigService);
    notificationQueue = module.get(getQueueToken('notification'));

    // Setup default config
    configService.get.mockImplementation((key: string, defaultValue?: any) => {
      const config = {
        BIRTHDAY_CHECK_HOUR: 9,
        RETRY_ATTEMPTS: 3,
        RETRY_DELAY_BASE: 60000,
      };
      return config[key] || defaultValue;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('scheduleEvents Cron Job', () => {
    it('should run every minute and check for 9 AM timezones', async () => {
      // Arrange
      const timezones = ['America/New_York', 'Europe/London'];
      MockedTimezoneUtil.getTimezonesAtHour.mockReturnValue(timezones);
      userService.findBirthdayUsersInTimezone.mockResolvedValue([]);

      // Act
      await service.scheduleEvents();

      // Assert
      expect(MockedTimezoneUtil.getTimezonesAtHour).toHaveBeenCalledWith(9);
      expect(userService.findBirthdayUsersInTimezone).toHaveBeenCalledTimes(2);
    });

    it('should process birthday users when found', async () => {
      // Arrange
      const mockUser = {
        id: 'user-1',
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'John Doe',
        birthday: new Date('1990-01-15'),
        timezone: 'America/New_York',
      };
      const mockEventLog = {
        id: 'event-1',
        userId: 'user-1',
        eventType: 'BIRTHDAY',
        status: 'PENDING',
      };

      MockedTimezoneUtil.getTimezonesAtHour.mockReturnValue([
        'America/New_York',
      ]);
      userService.findBirthdayUsersInTimezone.mockResolvedValue([mockUser]);
      eventService.processEventsForTimezone.mockResolvedValue([mockEventLog]);

      // Act
      await service.scheduleEvents();

      // Assert
      expect(eventService.processEventsForTimezone).toHaveBeenCalledWith(
        'America/New_York',
        [mockUser],
      );
    });

    it('should handle multiple timezones with different user counts', async () => {
      // Arrange
      const mockUser1 = { id: 'user-1', fullName: 'John Doe' };
      const mockUser2 = { id: 'user-2', fullName: 'Jane Doe' };
      const mockUser3 = { id: 'user-3', fullName: 'Bob Smith' };

      MockedTimezoneUtil.getTimezonesAtHour.mockReturnValue([
        'America/New_York',
        'Europe/London',
        'Asia/Tokyo',
      ]);

      userService.findBirthdayUsersInTimezone
        .mockResolvedValueOnce([mockUser1]) // New York: 1 user
        .mockResolvedValueOnce([]) // London: 0 users
        .mockResolvedValueOnce([mockUser2, mockUser3]); // Tokyo: 2 users

      eventService.processEventsForTimezone
        .mockResolvedValueOnce([{ id: 'event-1' }]) // New York: 1 event
        .mockResolvedValueOnce([]) // London: 0 events (not called)
        .mockResolvedValueOnce([{ id: 'event-2' }, { id: 'event-3' }]); // Tokyo: 2 events

      // Act
      await service.scheduleEvents();

      // Assert
      expect(userService.findBirthdayUsersInTimezone).toHaveBeenCalledTimes(3);
      expect(eventService.processEventsForTimezone).toHaveBeenCalledTimes(2); // Only called for timezones with users
    });

    it('should log appropriate messages for different scenarios', async () => {
      // Arrange
      const loggerSpy = jest.spyOn(service['logger'], 'log');
      const debugSpy = jest.spyOn(service['logger'], 'debug');

      MockedTimezoneUtil.getTimezonesAtHour.mockReturnValue([
        'America/New_York',
        'Europe/London',
      ]);
      userService.findBirthdayUsersInTimezone
        .mockResolvedValueOnce([{ id: 'user-1', fullName: 'John Doe' }]) // New York has users
        .mockResolvedValueOnce([]); // London has no users

      eventService.processEventsForTimezone.mockResolvedValue([
        { id: 'event-1' },
      ]);

      // Act
      await service.scheduleEvents();

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith(
        '[scheduleEvents] Starting hourly event scheduling',
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        'Found 2 timezones at 9 AM: America/New_York, Europe/London',
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        'Found 1 birthday users in America/New_York',
      );
      expect(debugSpy).toHaveBeenCalledWith(
        'No birthday users found for timezone: Europe/London',
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        'Completed hourly event scheduling',
      );
    });
  });

  describe('scheduleCleanup Cron Job', () => {
    it('should run daily at 2 AM and clean old events', async () => {
      // Arrange
      eventService.cleanupOldEvents.mockResolvedValue(5);

      // Act
      await service.scheduleCleanup();

      // Assert
      expect(eventService.cleanupOldEvents).toHaveBeenCalled();
    });
  });

  describe('testCron Job', () => {
    it('should run every minute and log test message', async () => {
      // Arrange
      const loggerSpy = jest.spyOn(service['logger'], 'log');
      const mockDate = new Date('2024-01-15T10:30:00Z');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate);

      // Act
      await service.testCron();

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith(
        `🔥 TEST CRON - Running every minute: ${mockDate.toISOString()}`,
      );

      // Cleanup
      jest.restoreAllMocks();
    });

    it('should complete without errors', async () => {
      // Act & Assert
      await expect(service.testCron()).resolves.not.toThrow();
    });
  });

  describe('Cron Job Integration', () => {
    it('should handle all cron jobs running simultaneously', async () => {
      // Arrange
      MockedTimezoneUtil.getTimezonesAtHour.mockReturnValue([
        'America/New_York',
      ]);
      userService.findBirthdayUsersInTimezone.mockResolvedValue([]);
      eventService.getFailedEventsForRetry.mockResolvedValue([]);
      eventService.cleanupOldEvents.mockResolvedValue(0);

      // Act - Run all cron jobs
      await Promise.all([
        service.scheduleEvents(),
        service.scheduleEventRecovery(),
        service.scheduleCleanup(),
        service.testCron(),
      ]);

      // Assert
      expect(MockedTimezoneUtil.getTimezonesAtHour).toHaveBeenCalled();
      expect(eventService.getFailedEventsForRetry).toHaveBeenCalled();
      expect(eventService.cleanupOldEvents).toHaveBeenCalled();
    });

    it('should maintain state consistency across multiple cron runs', async () => {
      // Arrange
      const mockUser = { id: 'user-1', fullName: 'John Doe' };
      MockedTimezoneUtil.getTimezonesAtHour.mockReturnValue([
        'America/New_York',
      ]);
      userService.findBirthdayUsersInTimezone.mockResolvedValue([mockUser]);
      eventService.processEventsForTimezone.mockResolvedValue([
        { id: 'event-1' },
      ]);

      // Act - Run scheduleEvents multiple times
      await service.scheduleEvents();
      await service.scheduleEvents();
      await service.scheduleEvents();

      // Assert
      expect(MockedTimezoneUtil.getTimezonesAtHour).toHaveBeenCalledTimes(3);
      expect(userService.findBirthdayUsersInTimezone).toHaveBeenCalledTimes(3);
      expect(notificationQueue.add).toHaveBeenCalledTimes(3);
    });
  });

  describe('Timezone Handling', () => {
    it('should handle different timezone formats', async () => {
      // Arrange
      const timezones = [
        'America/New_York',
        'Europe/London',
        'Asia/Tokyo',
        'Australia/Sydney',
        'UTC',
      ];
      MockedTimezoneUtil.getTimezonesAtHour.mockReturnValue(timezones);
      userService.findBirthdayUsersInTimezone.mockResolvedValue([]);

      // Act
      await service.scheduleEvents();

      // Assert
      expect(MockedTimezoneUtil.getTimezonesAtHour).toHaveBeenCalledWith(9);
      expect(userService.findBirthdayUsersInTimezone).toHaveBeenCalledTimes(5);
      timezones.forEach((timezone) => {
        expect(userService.findBirthdayUsersInTimezone).toHaveBeenCalledWith(
          timezone,
        );
      });
    });

    it('should handle empty timezone list', async () => {
      // Arrange
      MockedTimezoneUtil.getTimezonesAtHour.mockReturnValue([]);

      // Act
      await service.scheduleEvents();

      // Assert
      expect(MockedTimezoneUtil.getTimezonesAtHour).toHaveBeenCalledWith(9);
      expect(userService.findBirthdayUsersInTimezone).not.toHaveBeenCalled();
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle high frequency cron execution', async () => {
      // Arrange
      MockedTimezoneUtil.getTimezonesAtHour.mockReturnValue([
        'America/New_York',
      ]);
      userService.findBirthdayUsersInTimezone.mockResolvedValue([]);

      // Act - Simulate rapid cron execution
      const promises = Array.from({ length: 10 }, () =>
        service.scheduleEvents(),
      );
      await Promise.all(promises);

      // Assert
      expect(MockedTimezoneUtil.getTimezonesAtHour).toHaveBeenCalledTimes(10);
    });

    it('should handle large number of timezones efficiently', async () => {
      // Arrange
      const manyTimezones = Array.from(
        { length: 50 },
        (_, i) => `Timezone_${i}`,
      );
      MockedTimezoneUtil.getTimezonesAtHour.mockReturnValue(manyTimezones);
      userService.findBirthdayUsersInTimezone.mockResolvedValue([]);

      // Act
      await service.scheduleEvents();

      // Assert
      expect(userService.findBirthdayUsersInTimezone).toHaveBeenCalledTimes(50);
    });
  });
});
