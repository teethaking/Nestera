import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { BlockchainReplayService } from './blockchain-replay.service';
import {
  BlockchainReplayJob,
  ReplayJobMode,
  ReplayJobStatus,
} from './entities/blockchain-replay-job.entity';
import { IndexerService } from './indexer.service';
import { DistributedLockService } from '../../common/distributed-lock/distributed-lock.service';
import { AuditLogService } from '../../common/services/audit-log.service';

describe('BlockchainReplayService', () => {
  let service: BlockchainReplayService;
  let replayJobRepo: any;
  let indexerService: jest.Mocked<IndexerService>;
  let lockService: jest.Mocked<DistributedLockService>;

  beforeEach(async () => {
    replayJobRepo = {
      findOne: jest.fn(),
      save: jest
        .fn()
        .mockImplementation((val) => Promise.resolve({ id: 'job-1', ...val })),
      create: jest.fn().mockImplementation((val) => val),
    };

    indexerService = {
      reloadContractIds: jest.fn(),
      fetchEventsFromRange: jest.fn().mockResolvedValue([]),
      processEventsForReplay: jest
        .fn()
        .mockResolvedValue({ processed: 0, failed: 0, skipped: 0 }),
      refreshState: jest.fn(),
    } as unknown as jest.Mocked<IndexerService>;

    lockService = {
      acquireLock: jest.fn().mockResolvedValue({
        ownerId: 'owner-1',
        release: jest.fn(),
      }),
    } as unknown as jest.Mocked<DistributedLockService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BlockchainReplayService,
        {
          provide: getRepositoryToken(BlockchainReplayJob),
          useValue: replayJobRepo,
        },
        { provide: IndexerService, useValue: indexerService },
        { provide: DistributedLockService, useValue: lockService },
        {
          provide: AuditLogService,
          useValue: { log: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: unknown) => {
              if (key === 'blockchainReplay.maxLedgerRange') return 1000;
              if (key === 'distributedLock.replayTtlMs') return 60_000;
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get(BlockchainReplayService);
  });

  it('rejects invalid ledger ranges', async () => {
    await expect(
      service.createReplayJob(
        {
          mode: ReplayJobMode.LEDGER_RANGE,
          startLedger: 200,
          endLedger: 100,
        },
        'admin-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects concurrent replay jobs', async () => {
    replayJobRepo.findOne.mockResolvedValue({
      id: 'active',
      status: ReplayJobStatus.RUNNING,
    });

    await expect(
      service.createReplayJob(
        {
          mode: ReplayJobMode.LEDGER_RANGE,
          startLedger: 100,
          endLedger: 110,
        },
        'admin-1',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('reports replay progress', () => {
    const progress = service.toProgress({
      id: 'job-1',
      mode: ReplayJobMode.LEDGER_RANGE,
      status: ReplayJobStatus.RUNNING,
      eventsProcessed: 5,
      eventsFailed: 1,
      eventsSkipped: 2,
      totalEvents: 10,
      lastError: null,
      startedAt: new Date(),
      completedAt: null,
    } as BlockchainReplayJob);

    expect(progress.progressPercent).toBe(80);
  });
});
