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

describe('SchedulerService', () => {
  let service: SchedulerService;
  let userService: jest.Mocked<UserService>;
  let eventService: jest.Mocked<EventService>;
  let configService: jest.Mocked<ConfigService>;
  let eventQueue: any;
  let notificationQueue: any;

  // Mock user data
  const mockUser = {
    id: 'user-1',
    firstName: 'John',
    lastName: 'Doe',
    fullName: 'John Doe',
    birthday: new Date('1990-01-15'),
    timezone: 'America/New_York',
    location: 'New York',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockEventLog = {
    id: 'event-1',
    userId: 'user-1',
    eventType: 'BIRTHDAY',
    eventYear: 2024,
    status: 'PENDING',
    metadata: {
      timezone: 'America/New_York',
      message: "Hey, John Doe it's your birthday",
    },
    retryCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    // Create mock implementations
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

    const mockEventQueue = {
      add: jest.fn(),
      getJobCounts: jest.fn(),
    };

    const mockNotificationQueue = {
      add: jest.fn(),
      getJobCounts: jest.fn(),
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
          useValue: mockEventQueue,
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
    eventQueue = module.get(getQueueToken('event-processing'));
    notificationQueue = module.get(getQueueToken('notification'));

    // Setup default config values
    configService.get.mockImplementation((key: string, defaultValue?: any) => {
      const config: Record<string, any> = {
        BIRTHDAY_CHECK_HOUR: 9,
        RETRY_ATTEMPTS: 3,
        RETRY_DELAY_BASE: 60000,
      };
      return config[key] !== undefined ? config[key] : defaultValue;
    });

    // Setup default TimezoneUtil mock
    MockedTimezoneUtil.getTimezonesAtHour.mockReturnValue([
      'America/New_York',
      'Europe/London',
    ]);
    MockedTimezoneUtil.isBirthdayToday.mockReturnValue(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should initialize with correct configuration values', () => {
      expect(configService.get).toHaveBeenCalledWith('BIRTHDAY_CHECK_HOUR', 9);
      expect(configService.get).toHaveBeenCalledWith('RETRY_ATTEMPTS', 3);
      expect(configService.get).toHaveBeenCalledWith('RETRY_DELAY_BASE', 60000);
    });
  });

  describe('scheduleEvents', () => {
    it('should process all timezones at 9 AM', async () => {
      // Arrange
      const timezones = ['America/New_York', 'Europe/London'];
      MockedTimezoneUtil.getTimezonesAtHour.mockReturnValue(timezones);
      userService.findBirthdayUsersInTimezone.mockResolvedValue([]);

      // Act
      await service.scheduleEvents();

      // Assert
      expect(MockedTimezoneUtil.getTimezonesAtHour).toHaveBeenCalledWith(9);
      expect(userService.findBirthdayUsersInTimezone).toHaveBeenCalledTimes(2);
      expect(userService.findBirthdayUsersInTimezone).toHaveBeenCalledWith(
        'America/New_York',
      );
      expect(userService.findBirthdayUsersInTimezone).toHaveBeenCalledWith(
        'Europe/London',
      );
    });

    it('should handle timezones with no birthday users', async () => {
      // Arrange
      const timezones = ['America/New_York'];
      MockedTimezoneUtil.getTimezonesAtHour.mockReturnValue(timezones);
      userService.findBirthdayUsersInTimezone.mockResolvedValue([]);

      // Act
      await service.scheduleEvents();

      // Assert
      expect(userService.findBirthdayUsersInTimezone).toHaveBeenCalledWith(
        'America/New_York',
      );
      expect(eventService.processEventsForTimezone).not.toHaveBeenCalled();
      expect(notificationQueue.add).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      // Arrange
      const timezones = ['America/New_York'];
      MockedTimezoneUtil.getTimezonesAtHour.mockReturnValue(timezones);
      userService.findBirthdayUsersInTimezone.mockRejectedValue(
        new Error('Database error'),
      );

      // Act
      await service.scheduleEvents();

      // Assert
      expect(userService.findBirthdayUsersInTimezone).toHaveBeenCalledWith(
        'America/New_York',
      );
      // Should not throw error, just log it
    });
  });

  describe('scheduleCleanup', () => {
    it('should clean up old events', async () => {
      // Arrange
      eventService.cleanupOldEvents.mockResolvedValue(5);

      // Act
      await service.scheduleCleanup();

      // Assert
      expect(eventService.cleanupOldEvents).toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      // Arrange
      eventService.cleanupOldEvents.mockRejectedValue(
        new Error('Cleanup error'),
      );

      // Act
      await service.scheduleCleanup();

      // Assert
      expect(eventService.cleanupOldEvents).toHaveBeenCalled();
      // Should not throw error, just log it
    });
  });

  describe('testCron', () => {
    it('should run without errors', async () => {
      // Act & Assert
      await expect(service.testCron()).resolves.not.toThrow();
    });
  });

  describe('processTimezone (private method)', () => {
    it('should process timezone with birthday users', async () => {
      // Arrange
      userService.findBirthdayUsersInTimezone.mockResolvedValue([mockUser]);
      eventService.processEventsForTimezone.mockResolvedValue([mockEventLog]);

      // Act - using reflection to access private method
      const processTimezone = (service as any).processTimezone.bind(service);
      await processTimezone('America/New_York');

      // Assert
      expect(userService.findBirthdayUsersInTimezone).toHaveBeenCalledWith(
        'America/New_York',
      );
      expect(eventService.processEventsForTimezone).toHaveBeenCalledWith(
        'America/New_York',
        [mockUser],
      );
      expect(notificationQueue.add).toHaveBeenCalledTimes(1);
    });

    it('should handle timezone with no birthday users', async () => {
      // Arrange
      userService.findBirthdayUsersInTimezone.mockResolvedValue([]);

      // Act
      const processTimezone = (service as any).processTimezone.bind(service);
      await processTimezone('America/New_York');

      // Assert
      expect(userService.findBirthdayUsersInTimezone).toHaveBeenCalledWith(
        'America/New_York',
      );
      expect(eventService.processEventsForTimezone).not.toHaveBeenCalled();
      expect(notificationQueue.add).not.toHaveBeenCalled();
    });

    it('should handle processing errors', async () => {
      // Arrange
      userService.findBirthdayUsersInTimezone.mockRejectedValue(
        new Error('Processing error'),
      );

      // Act
      const processTimezone = (service as any).processTimezone.bind(service);
      await processTimezone('America/New_York');

      // Assert
      expect(userService.findBirthdayUsersInTimezone).toHaveBeenCalledWith(
        'America/New_York',
      );
      // Should not throw error, just log it
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete birthday notification flow', async () => {
      // Arrange
      const timezones = ['America/New_York'];
      MockedTimezoneUtil.getTimezonesAtHour.mockReturnValue(timezones);
      userService.findBirthdayUsersInTimezone.mockResolvedValue([mockUser]);
      eventService.processEventsForTimezone.mockResolvedValue([mockEventLog]);

      // Act
      await service.scheduleEvents();

      // Assert - Complete flow verification
      expect(MockedTimezoneUtil.getTimezonesAtHour).toHaveBeenCalledWith(9);
      expect(userService.findBirthdayUsersInTimezone).toHaveBeenCalledWith(
        'America/New_York',
      );
      expect(eventService.processEventsForTimezone).toHaveBeenCalledWith(
        'America/New_York',
        [mockUser],
      );
    });

    it('should handle multiple timezones with different results', async () => {
      // Arrange
      const timezones = ['America/New_York', 'Europe/London', 'Asia/Tokyo'];
      MockedTimezoneUtil.getTimezonesAtHour.mockReturnValue(timezones);

      userService.findBirthdayUsersInTimezone
        .mockResolvedValueOnce([mockUser]) // New York has users
        .mockResolvedValueOnce([]) // London has no users
        .mockResolvedValueOnce([mockUser, { ...mockUser, id: 'user-2' }]); // Tokyo has 2 users

      eventService.processEventsForTimezone
        .mockResolvedValueOnce([mockEventLog]) // New York events
        .mockResolvedValueOnce([]) // London events (empty)
        .mockResolvedValueOnce([
          mockEventLog,
          { ...mockEventLog, id: 'event-2' },
        ]); // Tokyo events

      // Act
      await service.scheduleEvents();

      // Assert
      expect(userService.findBirthdayUsersInTimezone).toHaveBeenCalledTimes(3);
      expect(eventService.processEventsForTimezone).toHaveBeenCalledTimes(2); // Only called for timezones with users
    });
  });
});
