import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { IndexerService } from './indexer.service';
import { IndexerState } from './entities/indexer-state.entity';
import { DeadLetterEvent } from './entities/dead-letter-event.entity';
import { SavingsProduct } from '../savings/entities/savings-product.entity';
import { StellarService } from './stellar.service';
import { DepositHandler } from './event-handlers/deposit.handler';
import { WithdrawHandler } from './event-handlers/withdraw.handler';
import { YieldHandler } from './event-handlers/yield.handler';
import { IndexerCheckpointService } from './indexer-checkpoint.service';
import { DistributedLockService } from '../../common/distributed-lock/distributed-lock.service';

describe('IndexerService', () => {
  let service: IndexerService;
  let stellarService: StellarService;
  let checkpointService: jest.Mocked<IndexerCheckpointService>;
  let lockService: jest.Mocked<DistributedLockService>;
  let deadLetterRepo: any;
  let depositHandler: any;

  const mockIndexerState: IndexerState = {
    id: 'uuid',
    streamId: 'savings-indexer',
    lastProcessedLedger: 100,
    lastProcessedEventCursor: null,
    checkpointChecksum: null,
    lastProcessedTimestamp: null,
    totalEventsProcessed: 0,
    totalEventsFailed: 0,
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    checkpointService = {
      loadOrCreateState: jest.fn().mockResolvedValue({ ...mockIndexerState }),
      persistAfterSuccessfulEvent: jest
        .fn()
        .mockImplementation(async (input) => ({
          ...mockIndexerState,
          lastProcessedLedger: input.lastProcessedLedger,
          totalEventsProcessed: input.totalEventsProcessed,
        })),
      recordFailure: jest.fn(),
      isEventProcessed: jest.fn().mockResolvedValue(false),
    } as unknown as jest.Mocked<IndexerCheckpointService>;

    lockService = {
      acquireLock: jest.fn().mockResolvedValue({
        ownerId: 'owner',
        release: jest.fn(),
        renew: jest.fn(),
      }),
    } as unknown as jest.Mocked<DistributedLockService>;

    deadLetterRepo = {
      save: jest.fn().mockImplementation((val) => Promise.resolve(val)),
      create: jest.fn().mockImplementation((val) => val),
    };

    stellarService = {
      getEvents: jest.fn(),
    } as any;

    depositHandler = { handle: jest.fn().mockResolvedValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IndexerService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(25_000) },
        },
        { provide: StellarService, useValue: stellarService },
        {
          provide: getRepositoryToken(DeadLetterEvent),
          useValue: deadLetterRepo,
        },
        {
          provide: getRepositoryToken(IndexerState),
          useValue: {},
        },
        {
          provide: getRepositoryToken(SavingsProduct),
          useValue: {
            find: jest
              .fn()
              .mockResolvedValue([{ contractId: 'CC1', isActive: true }]),
          },
        },
        { provide: DepositHandler, useValue: depositHandler },
        { provide: WithdrawHandler, useValue: { handle: jest.fn() } },
        { provide: YieldHandler, useValue: { handle: jest.fn() } },
        { provide: IndexerCheckpointService, useValue: checkpointService },
        { provide: DistributedLockService, useValue: lockService },
      ],
    }).compile();

    service = module.get(IndexerService);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => null);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => null);
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => null);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => null);
  });

  it('skips indexer cycle when lock is unavailable', async () => {
    lockService.acquireLock.mockResolvedValueOnce(null);
    await service.onModuleInit();
    await service.runIndexerCycle();
    expect(stellarService.getEvents).not.toHaveBeenCalled();
  });

  it('processes events and persists checkpoint on success', async () => {
    await service.onModuleInit();
    (stellarService.getEvents as jest.Mock).mockResolvedValue([
      {
        id: 'evt-1',
        ledger: '101',
        topic: ['deposit'],
        value: '100',
        txHash: 'hash1',
        contractId: 'CC1',
      },
    ]);

    await service.runIndexerCycle();

    expect(checkpointService.persistAfterSuccessfulEvent).toHaveBeenCalled();
    expect(service.getIndexerState()?.lastProcessedLedger).toBe(101);
  });

  it('deduplicates replay events already processed', async () => {
    await service.onModuleInit();
    checkpointService.isEventProcessed.mockResolvedValueOnce(true);

    const result = await service.processEventsForReplay([
      {
        id: 'evt-dup',
        ledger: 101,
        contractId: 'CC1',
      },
    ]);

    expect(result.skipped).toBe(1);
    expect(result.processed).toBe(0);
  });
});
