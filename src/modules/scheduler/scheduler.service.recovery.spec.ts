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

describe('SchedulerService - Recovery and Error Handling', () => {
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

  describe('Error Recovery in scheduleEvents', () => {
    it('should recover from TimezoneUtil errors', async () => {
      // Arrange
      MockedTimezoneUtil.getTimezonesAtHour.mockImplementation(() => {
        throw new Error('Timezone calculation failed');
      });

      // Act & Assert
      await expect(service.scheduleEvents()).resolves.not.toThrow();
    });

    it('should recover from UserService errors', async () => {
      // Arrange
      MockedTimezoneUtil.getTimezonesAtHour.mockReturnValue(['America/New_York']);
      userService.findBirthdayUsersInTimezone.mockRejectedValue(new Error('Database connection lost'));

      // Act & Assert
      await expect(service.scheduleEvents()).resolves.not.toThrow();
    });

    it('should recover from EventService errors', async () => {
      // Arrange
      const mockUser = { id: 'user-1', fullName: 'John Doe' };
      MockedTimezoneUtil.getTimezonesAtHour.mockReturnValue(['America/New_York']);
      userService.findBirthdayUsersInTimezone.mockResolvedValue([mockUser]);
      eventService.processEventsForTimezone.mockRejectedValue(new Error('Event processing failed'));

      // Act & Assert
      await expect(service.scheduleEvents()).resolves.not.toThrow();
    });

    it('should recover from notification queue errors', async () => {
      // Arrange
      const mockUser = { id: 'user-1', fullName: 'John Doe' };
      const mockEventLog = { id: 'event-1' };
      MockedTimezoneUtil.getTimezonesAtHour.mockReturnValue(['America/New_York']);
      userService.findBirthdayUsersInTimezone.mockResolvedValue([mockUser]);
      eventService.processEventsForTimezone.mockResolvedValue([mockEventLog]);
      notificationQueue.add.mockRejectedValue(new Error('Queue service unavailable'));

      // Act & Assert
      await expect(service.scheduleEvents()).resolves.not.toThrow();
    });

    it('should log errors appropriately', async () => {
      // Arrange
      const loggerSpy = jest.spyOn(service['logger'], 'error');
      MockedTimezoneUtil.getTimezonesAtHour.mockImplementation(() => {
        throw new Error('Timezone calculation failed');
      });

      // Act
      await service.scheduleEvents();

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith(
        'Error in hourly event scheduling',
        expect.stringContaining('Timezone calculation failed')
      );
    });
  });

  describe('Error Recovery in scheduleEventRecovery', () => {
    it('should recover from EventService.getFailedEventsForRetry errors', async () => {
      // Arrange
      eventService.getFailedEventsForRetry.mockRejectedValue(new Error('Database query failed'));

      // Act & Assert
      await expect(service.scheduleEventRecovery()).resolves.not.toThrow();
    });

    it('should recover from notification queue errors during recovery', async () => {
      // Arrange
      const failedEvents = [{ id: 'event-1', retryCount: 1 }];
      eventService.getFailedEventsForRetry.mockResolvedValue(failedEvents);
      notificationQueue.add.mockRejectedValue(new Error('Queue service down'));

      // Act & Assert
      await expect(service.scheduleEventRecovery()).resolves.not.toThrow();
    });

    it('should log recovery errors appropriately', async () => {
      // Arrange
      const loggerSpy = jest.spyOn(service['logger'], 'error');
      eventService.getFailedEventsForRetry.mockRejectedValue(new Error('Recovery failed'));

      // Act
      await service.scheduleEventRecovery();

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith(
        'Error in event recovery process',
        expect.stringContaining('Recovery failed')
      );
    });
  });

  describe('Error Recovery in scheduleCleanup', () => {
    it('should recover from EventService.cleanupOldEvents errors', async () => {
      // Arrange
      eventService.cleanupOldEvents.mockRejectedValue(new Error('Cleanup operation failed'));

      // Act & Assert
      await expect(service.scheduleCleanup()).resolves.not.toThrow();
    });

    it('should log cleanup errors appropriately', async () => {
      // Arrange
      const loggerSpy = jest.spyOn(service['logger'], 'error');
      eventService.cleanupOldEvents.mockRejectedValue(new Error('Cleanup failed'));

      // Act
      await service.scheduleCleanup();

      // Assert
      expect(loggerSpy).toHaveBeenCalledWith(
        'Error in cleanup process',
        expect.stringContaining('Cleanup failed')
      );
    });
  });

  describe('Partial Failure Recovery', () => {
    it('should continue processing other timezones when one fails', async () => {
      // Arrange
      const mockUser1 = { id: 'user-1', fullName: 'John Doe' };
      const mockUser2 = { id: 'user-2', fullName: 'Jane Doe' };
      
      MockedTimezoneUtil.getTimezonesAtHour.mockReturnValue(['America/New_York', 'Europe/London']);
      
      userService.findBirthdayUsersInTimezone
        .mockRejectedValueOnce(new Error('New York timezone failed'))
        .mockResolvedValueOnce([mockUser2]);

      eventService.processEventsForTimezone.mockResolvedValue([{ id: 'event-2' }]);

      // Act
      await service.scheduleEvents();

      // Assert
      expect(userService.findBirthdayUsersInTimezone).toHaveBeenCalledWith('America/New_York');
      expect(userService.findBirthdayUsersInTimezone).toHaveBeenCalledWith('Europe/London');
      expect(eventService.processEventsForTimezone).toHaveBeenCalledWith('Europe/London', [mockUser2]);
      expect(notificationQueue.add).toHaveBeenCalledTimes(1);
    });
  });

  describe('Configuration Error Handling', () => {
    it('should handle missing configuration gracefully', async () => {
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

    it('should handle invalid configuration values', async () => {
      // Arrange
      configService.get.mockImplementation((key: string) => {
        if (key === 'RETRY_ATTEMPTS') return -1;
        if (key === 'RETRY_DELAY_BASE') return 0;
        if (key === 'BIRTHDAY_CHECK_HOUR') return 25; // Invalid hour
        return undefined;
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

  describe('Queue Error Handling', () => {
    it('should handle queue service being unavailable', async () => {
      // Arrange
      const mockUser = { id: 'user-1', fullName: 'John Doe' };
      const mockEventLog = { id: 'event-1' };
      
      MockedTimezoneUtil.getTimezonesAtHour.mockReturnValue(['America/New_York']);
      userService.findBirthdayUsersInTimezone.mockResolvedValue([mockUser]);
      eventService.processEventsForTimezone.mockResolvedValue([mockEventLog]);
      notificationQueue.add.mockRejectedValue(new Error('Queue service unavailable'));

      // Act & Assert
      await expect(service.scheduleEvents()).resolves.not.toThrow();
    });

    it('should handle queue returning null/undefined', async () => {
      // Arrange
      const mockUser = { id: 'user-1', fullName: 'John Doe' };
      const mockEventLog = { id: 'event-1' };
      
      MockedTimezoneUtil.getTimezonesAtHour.mockReturnValue(['America/New_York']);
      userService.findBirthdayUsersInTimezone.mockResolvedValue([mockUser]);
      eventService.processEventsForTimezone.mockResolvedValue([mockEventLog]);
      notificationQueue.add.mockResolvedValue(null);

      // Act & Assert
      await expect(service.scheduleEvents()).resolves.not.toThrow();
    });
  });

  describe('Data Integrity During Errors', () => {
    it('should not lose data when processing fails', async () => {
      // Arrange
      const mockUser = { id: 'user-1', fullName: 'John Doe' };
      const mockEventLog = { id: 'event-1' };
      
      MockedTimezoneUtil.getTimezonesAtHour.mockReturnValue(['America/New_York']);
      userService.findBirthdayUsersInTimezone.mockResolvedValue([mockUser]);
      eventService.processEventsForTimezone.mockResolvedValue([mockEventLog]);
      notificationQueue.add.mockRejectedValue(new Error('Queue failed'));

      // Act
      await service.scheduleEvents();

      // Assert
      expect(userService.findBirthdayUsersInTimezone).toHaveBeenCalledWith('America/New_York');
      expect(eventService.processEventsForTimezone).toHaveBeenCalledWith('America/New_York', [mockUser]);
      // Event was created even though notification failed
    });
  });
});
