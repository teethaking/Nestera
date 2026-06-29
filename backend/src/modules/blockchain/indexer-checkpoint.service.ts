import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { IndexerState } from './entities/indexer-state.entity';
import { ProcessedStellarEvent } from './entities/processed-event.entity';
import {
  computeCheckpointChecksum,
  INDEXER_STREAM_SAVINGS,
  isCheckpointChecksumValid,
} from './indexer-checkpoint.utils';

export interface PersistCheckpointInput {
  streamId?: string;
  lastProcessedLedger: number;
  lastProcessedEventCursor?: string | null;
  totalEventsProcessed?: number;
  totalEventsFailed?: number;
  eventId?: string;
  contractId?: string;
  transactionHash?: string;
  eventType?: string;
  eventData?: Record<string, unknown>;
}

@Injectable()
export class IndexerCheckpointService {
  private readonly logger = new Logger(IndexerCheckpointService.name);

  constructor(
    @InjectRepository(IndexerState)
    private readonly indexerStateRepo: Repository<IndexerState>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async loadOrCreateState(
    streamId: string = INDEXER_STREAM_SAVINGS,
  ): Promise<IndexerState> {
    let state = await this.indexerStateRepo.findOne({ where: { streamId } });

    if (!state) {
      state = await this.indexerStateRepo.save(
        this.indexerStateRepo.create({
          streamId,
          lastProcessedLedger: 0,
          lastProcessedEventCursor: null,
          lastProcessedTimestamp: null,
          totalEventsProcessed: 0,
          totalEventsFailed: 0,
          checkpointChecksum: null,
        }),
      );
      return state;
    }

    const snapshot = this.toSnapshot(state);
    if (!isCheckpointChecksumValid(snapshot, state.checkpointChecksum)) {
      this.logger.error(
        `Checkpoint checksum mismatch for stream ${streamId}; refusing to advance until repaired`,
      );
      throw new Error(`Corrupted checkpoint for stream ${streamId}`);
    }

    return state;
  }

  async persistAfterSuccessfulEvent(
    input: PersistCheckpointInput,
  ): Promise<IndexerState> {
    const streamId = input.streamId ?? INDEXER_STREAM_SAVINGS;

    return this.dataSource.transaction(async (manager) => {
      const stateRepo = manager.getRepository(IndexerState);
      const processedRepo = manager.getRepository(ProcessedStellarEvent);

      let state = await stateRepo.findOne({ where: { streamId } });
      if (!state) {
        state = stateRepo.create({
          streamId,
          lastProcessedLedger: 0,
          lastProcessedEventCursor: null,
          lastProcessedTimestamp: null,
          totalEventsProcessed: 0,
          totalEventsFailed: 0,
          checkpointChecksum: null,
        });
      }

      if (input.eventId && input.contractId) {
        const existing = await processedRepo.findOne({
          where: { contractId: input.contractId, eventId: input.eventId },
        });
        if (existing) {
          this.logger.debug(
            `Event ${input.eventId} already processed; skipping checkpoint advance`,
          );
          return state;
        }

        await processedRepo.save(
          processedRepo.create({
            eventId: input.eventId,
            contractId: input.contractId,
            transactionHash: input.transactionHash ?? 'unknown',
            ledger: input.lastProcessedLedger,
            eventType: input.eventType ?? 'unknown',
            eventData: input.eventData ?? {},
            claimId: null,
          }),
        );
      }

      state.lastProcessedLedger = Math.max(
        state.lastProcessedLedger,
        input.lastProcessedLedger,
      );
      if (input.lastProcessedEventCursor) {
        state.lastProcessedEventCursor = input.lastProcessedEventCursor;
      }
      state.lastProcessedTimestamp = Date.now();
      state.totalEventsProcessed =
        input.totalEventsProcessed ?? state.totalEventsProcessed + 1;
      if (input.totalEventsFailed !== undefined) {
        state.totalEventsFailed = input.totalEventsFailed;
      }

      state.checkpointChecksum = computeCheckpointChecksum(
        this.toSnapshot(state),
      );

      return stateRepo.save(state);
    });
  }

  async recordFailure(
    streamId: string = INDEXER_STREAM_SAVINGS,
  ): Promise<void> {
    const state = await this.indexerStateRepo.findOne({ where: { streamId } });
    if (!state) {
      return;
    }

    state.totalEventsFailed += 1;
    state.checkpointChecksum = computeCheckpointChecksum(
      this.toSnapshot(state),
    );
    await this.indexerStateRepo.save(state);
  }

  async isEventProcessed(
    contractId: string,
    eventId: string,
  ): Promise<boolean> {
    const existing = await this.dataSource
      .getRepository(ProcessedStellarEvent)
      .findOne({ where: { contractId, eventId } });

    return !!existing;
  }

  private toSnapshot(state: IndexerState) {
    return {
      streamId: state.streamId,
      lastProcessedLedger: Number(state.lastProcessedLedger),
      lastProcessedEventCursor: state.lastProcessedEventCursor,
      totalEventsProcessed: Number(state.totalEventsProcessed),
      totalEventsFailed: Number(state.totalEventsFailed),
    };
  }
}
