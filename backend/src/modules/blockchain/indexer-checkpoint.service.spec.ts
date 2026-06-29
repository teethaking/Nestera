import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { IndexerCheckpointService } from './indexer-checkpoint.service';
import { IndexerState } from './entities/indexer-state.entity';
import { ProcessedStellarEvent } from './entities/processed-event.entity';
import {
  INDEXER_STREAM_SAVINGS,
  computeCheckpointChecksum,
} from './indexer-checkpoint.utils';

describe('IndexerCheckpointService', () => {
  let service: IndexerCheckpointService;
  let stateRepo: any;
  let processedRepo: any;
  let transactionFn: jest.Mock;

  const baseState: IndexerState = {
    id: 'state-1',
    streamId: INDEXER_STREAM_SAVINGS,
    lastProcessedLedger: 100,
    lastProcessedEventCursor: 'cursor-100',
    lastProcessedTimestamp: Date.now(),
    totalEventsProcessed: 5,
    totalEventsFailed: 0,
    checkpointChecksum: null,
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    stateRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((val) => Promise.resolve(val)),
      create: jest.fn().mockImplementation((val) => val),
    };
    processedRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((val) => Promise.resolve(val)),
      create: jest.fn().mockImplementation((val) => val),
    };

    transactionFn = jest.fn(async (cb) =>
      cb({
        getRepository: (entity: unknown) => {
          if (entity === IndexerState) return stateRepo;
          if (entity === ProcessedStellarEvent) return processedRepo;
          return stateRepo;
        },
      }),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IndexerCheckpointService,
        {
          provide: getRepositoryToken(IndexerState),
          useValue: stateRepo,
        },
        {
          provide: DataSource,
          useValue: {
            transaction: transactionFn,
            getRepository: () => processedRepo,
          },
        },
      ],
    }).compile();

    service = module.get(IndexerCheckpointService);
  });

  it('loads existing checkpoint state', async () => {
    const snapshot = {
      streamId: baseState.streamId,
      lastProcessedLedger: Number(baseState.lastProcessedLedger),
      lastProcessedEventCursor: baseState.lastProcessedEventCursor,
      totalEventsProcessed: Number(baseState.totalEventsProcessed),
      totalEventsFailed: Number(baseState.totalEventsFailed),
    };

    stateRepo.findOne.mockResolvedValue({
      ...baseState,
      checkpointChecksum: computeCheckpointChecksum(snapshot),
    });

    const loaded = await service.loadOrCreateState();
    expect(loaded.lastProcessedLedger).toBe(100);
  });

  it('persists checkpoint after successful event processing', async () => {
    stateRepo.findOne.mockResolvedValue({ ...baseState });
    processedRepo.findOne.mockResolvedValue(null);

    const saved = await service.persistAfterSuccessfulEvent({
      lastProcessedLedger: 101,
      lastProcessedEventCursor: 'cursor-101',
      eventId: 'evt-1',
      contractId: 'contract-1',
      transactionHash: 'hash-1',
      eventType: 'Deposit',
    });

    expect(saved.lastProcessedLedger).toBe(101);
    expect(saved.checkpointChecksum).toBeTruthy();
    expect(processedRepo.save).toHaveBeenCalled();
  });

  it('skips duplicate events without advancing checkpoint counters twice', async () => {
    stateRepo.findOne.mockResolvedValue({ ...baseState });
    processedRepo.findOne.mockResolvedValue({ eventId: 'evt-1' });

    const saved = await service.persistAfterSuccessfulEvent({
      lastProcessedLedger: 101,
      eventId: 'evt-1',
      contractId: 'contract-1',
    });

    expect(saved.lastProcessedLedger).toBe(100);
    expect(processedRepo.save).not.toHaveBeenCalled();
  });

  it('detects processed events', async () => {
    processedRepo.findOne.mockResolvedValue({ eventId: 'evt-1' });
    expect(await service.isEventProcessed('contract-1', 'evt-1')).toBe(true);
  });
});
