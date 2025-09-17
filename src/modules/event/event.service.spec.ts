import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventService } from './event.service';
import { EventLog } from './entities/event-log.entity';
// import { BirthdayProcessor } from './processors/birthday.processor';
import { EventType } from '../../common/enums/event-type.enum';
import { NotificationStatus } from '../../common/enums/notification-status.enum';

describe('EventService', () => {
  let service: EventService;
  let repository: Repository<EventLog>;

  const mockBirthdayProcessor = {
    getEventType: () => EventType.BIRTHDAY,
    shouldTrigger: jest.fn(),
    buildMessage: jest.fn(),
    getScheduleTime: () => '0 9 * * *',
  };

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    increment: jest.fn(),
    createQueryBuilder: jest.fn(),
    count: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventService,
        {
          provide: getRepositoryToken(EventLog),
          useValue: mockRepository,
        },
        {
          provide: 'EVENT_PROCESSORS',
          useValue: [mockBirthdayProcessor],
        },
      ],
    }).compile();

    service = module.get<EventService>(EventService);
    repository = module.get<Repository<EventLog>>(getRepositoryToken(EventLog));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createEventLog', () => {
    it('should create a new event log', async () => {
      const eventLog = {
        id: 'event-123',
        userId: 'user-123',
        eventType: EventType.BIRTHDAY,
        eventYear: 2024,
        status: NotificationStatus.PENDING,
      };

      mockRepository.findOne.mockResolvedValue(null); // No existing event
      mockRepository.create.mockReturnValue(eventLog);
      mockRepository.save.mockResolvedValue(eventLog);

      const result = await service.createEventLog(
        'user-123',
        EventType.BIRTHDAY,
        2024,
      );

      expect(repository.save).toHaveBeenCalled();
      expect(result).toEqual(eventLog);
    });

    it('should return existing event log if already exists', async () => {
      const existingEvent = {
        id: 'event-123',
        userId: 'user-123',
        eventType: EventType.BIRTHDAY,
        eventYear: 2024,
      };

      mockRepository.findOne.mockResolvedValue(existingEvent);

      const result = await service.createEventLog(
        'user-123',
        EventType.BIRTHDAY,
        2024,
      );

      expect(repository.save).not.toHaveBeenCalled();
      expect(result).toEqual(existingEvent);
    });
  });
});
