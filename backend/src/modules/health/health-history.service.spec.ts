import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { HealthHistoryService } from './health-history.service';
import { HealthCheckRecord } from './entities/health-check-record.entity';

describe('HealthHistoryService', () => {
  let service: HealthHistoryService;
  const mockRepo = {
    create: jest.fn((data) => data),
    save: jest.fn((data) => Promise.resolve(data)),
    find: jest.fn().mockResolvedValue([]),
    delete: jest.fn().mockResolvedValue({ affected: 5 }),
    createQueryBuilder: jest.fn(() => ({
      orderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      select: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    })),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthHistoryService,
        {
          provide: getRepositoryToken(HealthCheckRecord),
          useValue: mockRepo,
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(30) },
        },
      ],
    }).compile();

    service = module.get(HealthHistoryService);
  });

  it('records health checks to repository', async () => {
    await service.recordCheck({
      service: 'database',
      status: 'up',
      responseTime: 42,
      timestamp: new Date(),
    });
    expect(mockRepo.save).toHaveBeenCalled();
  });

  it('enforces retention policy by deleting old records', async () => {
    await service.enforceRetentionPolicy();
    expect(mockRepo.delete).toHaveBeenCalled();
  });
});
