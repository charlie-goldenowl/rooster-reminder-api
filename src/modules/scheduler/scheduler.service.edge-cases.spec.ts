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

describe('SchedulerService - Edge Cases', () => {
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

  describe('Error Handling', () => {
    it('should handle TimezoneUtil.getTimezonesAtHour throwing error', async () => {
      // Arrange
      MockedTimezoneUtil.getTimezonesAtHour.mockImplementation(() => {
        throw new Error('Timezone calculation error');
      });

      // Act & Assert
      await expect(service.scheduleEvents()).resolves.not.toThrow();
    });

    it('should handle UserService.findBirthdayUsersInTimezone throwing error', async () => {
      // Arrange
      MockedTimezoneUtil.getTimezonesAtHour.mockReturnValue([
        'America/New_York',
      ]);
      userService.findBirthdayUsersInTimezone.mockRejectedValue(
        new Error('Database connection failed'),
      );

      // Act & Assert
      await expect(service.scheduleEvents()).resolves.not.toThrow();
    });

    it('should handle EventService.processEventsForTimezone throwing error', async () => {
      // Arrange
      const mockUser = { id: 'user-1', fullName: 'John Doe' };
      MockedTimezoneUtil.getTimezonesAtHour.mockReturnValue([
        'America/New_York',
      ]);
      userService.findBirthdayUsersInTimezone.mockResolvedValue([mockUser]);
      eventService.processEventsForTimezone.mockRejectedValue(
        new Error('Event processing failed'),
      );

      // Act & Assert
      await expect(service.scheduleEvents()).resolves.not.toThrow();
    });

    it('should handle notification queue throwing error', async () => {
      // Arrange
      const mockUser = { id: 'user-1', fullName: 'John Doe' };
      const mockEventLog = { id: 'event-1' };
      MockedTimezoneUtil.getTimezonesAtHour.mockReturnValue([
        'America/New_York',
      ]);
      userService.findBirthdayUsersInTimezone.mockResolvedValue([mockUser]);
      eventService.processEventsForTimezone.mockResolvedValue([mockEventLog]);
      notificationQueue.add.mockRejectedValue(
        new Error('Queue connection failed'),
      );

      // Act & Assert
      await expect(service.scheduleEvents()).resolves.not.toThrow();
    });
  });

  describe('Configuration Edge Cases', () => {
    it('should handle missing configuration values', async () => {
      // Arrange
      configService.get.mockReturnValue(undefined);

      // Act
      const service = new SchedulerService(
        userService,
        eventService,
        configService,
        { add: jest.fn() } as any,
        { add: jest.fn() } as any,
      );

      // Assert
      expect(service).toBeDefined();
    });

    it('should handle invalid retry attempts configuration', async () => {
      // Arrange
      configService.get.mockImplementation((key: string) => {
        if (key === 'RETRY_ATTEMPTS') return -1;
        if (key === 'RETRY_DELAY_BASE') return 0;
        return 9;
      });

      // Act
      const service = new SchedulerService(
        userService,
        eventService,
        configService,
        { add: jest.fn() } as any,
        { add: jest.fn() } as any,
      );

      // Assert
      expect(service).toBeDefined();
    });
  });

  describe('Data Edge Cases', () => {
    it('should handle empty timezone list', async () => {
      // Arrange
      MockedTimezoneUtil.getTimezonesAtHour.mockReturnValue([]);

      // Act
      await service.scheduleEvents();

      // Assert
      expect(userService.findBirthdayUsersInTimezone).not.toHaveBeenCalled();
      expect(eventService.processEventsForTimezone).not.toHaveBeenCalled();
      expect(notificationQueue.add).not.toHaveBeenCalled();
    });

    it('should handle users with invalid data', async () => {
      // Arrange
      const invalidUsers = [
        { id: null, fullName: 'John Doe' },
        { id: 'user-2', fullName: null },
        { id: 'user-3', fullName: 'Jane Doe' },
      ];
      MockedTimezoneUtil.getTimezonesAtHour.mockReturnValue([
        'America/New_York',
      ]);
      userService.findBirthdayUsersInTimezone.mockResolvedValue(
        invalidUsers as any,
      );
      eventService.processEventsForTimezone.mockResolvedValue([]);

      // Act
      await service.scheduleEvents();

      // Assert
      expect(eventService.processEventsForTimezone).toHaveBeenCalledWith(
        'America/New_York',
        invalidUsers,
      );
    });

    it('should handle event logs with missing required fields', async () => {
      // Arrange
      const mockUser = { id: 'user-1', fullName: 'John Doe' };
      const invalidEventLogs = [
        { id: null },
        { id: 'event-2', userId: null },
        { id: 'event-3', userId: 'user-3' },
      ];
      MockedTimezoneUtil.getTimezonesAtHour.mockReturnValue([
        'America/New_York',
      ]);
      userService.findBirthdayUsersInTimezone.mockResolvedValue([mockUser]);
      eventService.processEventsForTimezone.mockResolvedValue(
        invalidEventLogs as any,
      );

      // Act
      await service.scheduleEvents();

      // Assert
      expect(notificationQueue.add).toHaveBeenCalledTimes(3);
    });
  });

  describe('Concurrency and Race Conditions', () => {
    it('should handle concurrent scheduleEvents calls', async () => {
      // Arrange
      MockedTimezoneUtil.getTimezonesAtHour.mockReturnValue([
        'America/New_York',
      ]);
      userService.findBirthdayUsersInTimezone.mockResolvedValue([]);

      // Act - Call multiple times concurrently
      const promises = [
        service.scheduleEvents(),
        service.scheduleEvents(),
        service.scheduleEvents(),
      ];

      await Promise.all(promises);

      // Assert
      expect(MockedTimezoneUtil.getTimezonesAtHour).toHaveBeenCalledTimes(3);
    });

    it('should handle concurrent recovery and scheduling', async () => {
      // Arrange
      MockedTimezoneUtil.getTimezonesAtHour.mockReturnValue([
        'America/New_York',
      ]);
      userService.findBirthdayUsersInTimezone.mockResolvedValue([]);
      eventService.getFailedEventsForRetry.mockResolvedValue([]);

      // Act - Call both methods concurrently
      const promises = [
        service.scheduleEvents(),
        service.scheduleEventRecovery(),
      ];

      await Promise.all(promises);

      // Assert
      expect(MockedTimezoneUtil.getTimezonesAtHour).toHaveBeenCalled();
      expect(eventService.getFailedEventsForRetry).toHaveBeenCalled();
    });
  });

  describe('Memory and Performance', () => {
    it('should handle large number of birthday users', async () => {
      // Arrange
      const manyUsers = Array.from({ length: 1000 }, (_, i) => ({
        id: `user-${i}`,
        fullName: `User ${i}`,
      }));
      const manyEventLogs = Array.from({ length: 1000 }, (_, i) => ({
        id: `event-${i}`,
        userId: `user-${i}`,
      }));

      MockedTimezoneUtil.getTimezonesAtHour.mockReturnValue([
        'America/New_York',
      ]);
      userService.findBirthdayUsersInTimezone.mockResolvedValue(
        manyUsers as any,
      );
      eventService.processEventsForTimezone.mockResolvedValue(
        manyEventLogs as any,
      );

      // Act
      await service.scheduleEvents();

      // Assert
      expect(notificationQueue.add).toHaveBeenCalledTimes(1000);
    });

    it('should handle large number of failed events in recovery', async () => {
      // Arrange
      const manyFailedEvents = Array.from({ length: 500 }, (_, i) => ({
        id: `event-${i}`,
        retryCount: Math.floor(Math.random() * 5),
      }));

      eventService.getFailedEventsForRetry.mockResolvedValue(
        manyFailedEvents as any,
      );

      // Act
      await service.scheduleEventRecovery();

      // Assert
      expect(notificationQueue.add).toHaveBeenCalledTimes(500);
    });
  });

  describe('Cleanup Edge Cases', () => {
    it('should handle cleanup returning zero', async () => {
      // Arrange
      eventService.cleanupOldEvents.mockResolvedValue(0);

      // Act
      await service.scheduleCleanup();

      // Assert
      expect(eventService.cleanupOldEvents).toHaveBeenCalled();
    });

    it('should handle cleanup returning negative number', async () => {
      // Arrange
      eventService.cleanupOldEvents.mockResolvedValue(-5);

      // Act
      await service.scheduleCleanup();

      // Assert
      expect(eventService.cleanupOldEvents).toHaveBeenCalled();
    });
  });

  describe('Queue Edge Cases', () => {
    it('should handle queue add returning null', async () => {
      // Arrange
      const mockUser = { id: 'user-1', fullName: 'John Doe' };
      const mockEventLog = { id: 'event-1' };
      MockedTimezoneUtil.getTimezonesAtHour.mockReturnValue([
        'America/New_York',
      ]);
      userService.findBirthdayUsersInTimezone.mockResolvedValue([mockUser]);
      eventService.processEventsForTimezone.mockResolvedValue([mockEventLog]);
      notificationQueue.add.mockResolvedValue(null);

      // Act & Assert
      await expect(service.scheduleEvents()).resolves.not.toThrow();
    });

    it('should handle queue add returning undefined', async () => {
      // Arrange
      const mockUser = { id: 'user-1', fullName: 'John Doe' };
      const mockEventLog = { id: 'event-1' };
      MockedTimezoneUtil.getTimezonesAtHour.mockReturnValue([
        'America/New_York',
      ]);
      userService.findBirthdayUsersInTimezone.mockResolvedValue([mockUser]);
      eventService.processEventsForTimezone.mockResolvedValue([mockEventLog]);
      notificationQueue.add.mockResolvedValue(undefined);

      // Act & Assert
      await expect(service.scheduleEvents()).resolves.not.toThrow();
    });
  });
});
