import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { rpc } from '@stellar/stellar-sdk';
import { DeadLetterEvent } from './entities/dead-letter-event.entity';
import { IndexerState } from './entities/indexer-state.entity';
import { DepositHandler } from './event-handlers/deposit.handler';
import { YieldHandler } from './event-handlers/yield.handler';
import { StellarService } from './stellar.service';
import { SavingsProduct } from '../savings/entities/savings-product.entity';

/** Shape of a raw Soroban event as returned by the RPC. */
interface SorobanEvent {
  id?: string;
  ledger: number;
  topic?: unknown[];
  value?: unknown;
  txHash?: string;
  [key: string]: unknown;
}

/**
 * IndexerService: Active heartbeat tracking ledger sequences and catching
 * smart contract events (deposits/withdraws) emitted from Soroban.
 *
 * This service runs via @Cron(CronExpression.EVERY_5_SECONDS) and:
 * 1. Tracks the Horizon /ledgers and Soroban /getEvents endpoints
 * 2. Maintains lastProcessedLedger in database (IndexerState)
 * 3. Queries Soroban events for contract IDs tied to Savings Products
 * 4. Dispatches events to domain-specific handlers (deposits, yields, etc.)
 */
@Injectable()
export class IndexerService implements OnModuleInit {
  private readonly logger = new Logger(IndexerService.name);
  private rpcServer: rpc.Server | null = null;

  /** In-memory cache of contract IDs to monitor */
  private contractIds: Set<string> = new Set();

  /** In-memory state - synced with database on each cycle */
  private indexerState: IndexerState | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly stellarService: StellarService,
    @InjectRepository(DeadLetterEvent)
    private readonly dlqRepo: Repository<DeadLetterEvent>,
    @InjectRepository(IndexerState)
    private readonly indexerStateRepo: Repository<IndexerState>,
    @InjectRepository(SavingsProduct)
    private readonly savingsProductRepo: Repository<SavingsProduct>,
    private readonly depositHandler: DepositHandler,
    private readonly yieldHandler: YieldHandler,
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing Blockchain Event Indexer...');

    // Initialize RPC server instance
    this.rpcServer = this.stellarService.getRpcServer();

    // Load or create indexer state from database
    await this.initializeIndexerState();

    // Load all active contract IDs from Savings Products
    await this.loadContractIds();

    this.logger.log(
      `Blockchain indexer initialized. Monitoring ${this.contractIds.size} contract(s).`,
    );
  }

  /**
   * Cron job: Poll Soroban RPC every 5 seconds for new events.
   * This is the heartbeat that keeps the indexer synchronized with the blockchain.
   */
  @Cron(CronExpression.EVERY_5_SECONDS)
  async runIndexerCycle(): Promise<void> {
    if (!this.indexerState) {
      this.logger.warn('Indexer state not initialized. Skipping cycle.');
      return;
    }

    if (this.contractIds.size === 0) {
      this.logger.debug('No contracts to monitor. Skipping cycle.');
      return;
    }

    let events: SorobanEvent[] = [];

    try {
      events = await this.fetchEvents();
    } catch (err) {
      this.logger.error(
        `Failed to fetch events from Soroban RPC: ${(err as Error).message}`,
      );

      // Update last run timestamp even on failure for health checks
      this.indexerState.updatedAt = new Date();
      await this.saveIndexerState();
      return;
    }

    // Process each event and track progress
    let processedCount = 0;
    let failedCount = 0;

    for (const event of events) {
      const processed = await this.processEvent(event);
      if (processed) {
        processedCount++;
      } else {
        failedCount++;
      }
    }

    // Update statistics and persist state
    this.indexerState.totalEventsProcessed += processedCount;
    this.indexerState.totalEventsFailed += failedCount;
    this.indexerState.updatedAt = new Date();
    await this.saveIndexerState();

    if (processedCount > 0 || failedCount > 0) {
      this.logger.debug(
        `Indexer cycle complete: processed=${processedCount}, failed=${failedCount}, lastLedger=${this.indexerState.lastProcessedLedger}`,
      );
    }
  }

  /**
   * Load the IndexerState from database on startup.
   * Creates a new one if it doesn't exist.
   */
  private async initializeIndexerState(): Promise<void> {
    let state = await this.indexerStateRepo.findOne({ where: {} });

    if (!state) {
      state = this.indexerStateRepo.create({
        lastProcessedLedger: 0,
        lastProcessedTimestamp: null,
        totalEventsProcessed: 0,
        totalEventsFailed: 0,
      });
      state = await this.indexerStateRepo.save(state);
      this.logger.log('Created new IndexerState record');
    } else {
      this.logger.log(
        `Loaded IndexerState: lastLedger=${state.lastProcessedLedger}, totalProcessed=${state.totalEventsProcessed}`,
      );
    }

    this.indexerState = state;
  }

  /**
   * Load all active contract IDs from Savings Products.
   * These are the contracts we monitor for events.
   */
  private async loadContractIds(): Promise<void> {
    const products = await this.savingsProductRepo.find({
      where: { isActive: true },
    });

    this.contractIds.clear();
    for (const product of products) {
      if (product.contractId) {
        this.contractIds.add(product.contractId);
      }
    }

    this.logger.log(
      `Loaded ${this.contractIds.size} active contract ID(s) from Savings Products`,
    );
  }

  /**
   * Persist IndexerState to database.
   * Called after each successful cycle to save progress.
   */
  private async saveIndexerState(): Promise<void> {
    if (!this.indexerState) {
      return;
    }

    try {
      await this.indexerStateRepo.save(this.indexerState);
    } catch (err) {
      this.logger.error(
        `Failed to save IndexerState: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Process a single Soroban event.
   * Returns true if the event was handled without error, false otherwise.
   */
  private async processEvent(event: SorobanEvent): Promise<boolean> {
    try {
      await this.handleEvent(event);

      // Update state tracking
      if (
        this.indexerState &&
        event.ledger > this.indexerState.lastProcessedLedger
      ) {
        this.indexerState.lastProcessedLedger = event.ledger;
        this.indexerState.lastProcessedTimestamp = Date.now();
      }

      return true;
    } catch (err) {
      const errorMessage = (err as Error).message ?? String(err);

      this.logger.error(
        `Event processing failed at ledger=${event.ledger}: ${errorMessage}`,
      );

      // Record failed event in dead-letter queue for later investigation
      try {
        await this.dlqRepo.save(
          this.dlqRepo.create({
            ledgerSequence: event.ledger,
            rawEvent: JSON.stringify(event),
            errorMessage,
          }),
        );
      } catch (dlqErr) {
        this.logger.error(
          `Failed to save dead-letter event: ${(dlqErr as Error).message}`,
        );
      }

      return false;
    }
  }

  /**
   * Core event handler — parse and dispatch by event type.
   * Extend this method to handle additional domain-specific events.
   */
  private async handleEvent(event: SorobanEvent): Promise<void> {
    this.logger.debug(
      `Processing event at ledger=${event.ledger}, contractId=${(event.topic as any)?.[0]?.id ?? 'unknown'}`,
    );

    // Dispatch to domain-specific handlers
    const handledByDeposit = await this.depositHandler.handle(event);
    if (handledByDeposit) {
      this.logger.debug(`Handled deposit event at ledger=${event.ledger}`);
      return;
    }

    const handledByYield = await this.yieldHandler.handle(event);
    if (handledByYield) {
      this.logger.debug(`Handled yield event at ledger=${event.ledger}`);
      return;
    }

    // Unhandled event type - log for potential future handler implementation
    this.logger.debug(
      `Unhandled event type at ledger=${event.ledger}. Topic: ${JSON.stringify(event.topic)}`,
    );
  }

  /**
   * Fetches new Soroban events from the RPC since the last processed ledger.
   *
   * Uses the Soroban getEvents RPC method to query contract events for all
   * monitored contract IDs. Only returns events after lastProcessedLedger.
   */
  private async fetchEvents(): Promise<SorobanEvent[]> {
    if (!this.rpcServer || !this.indexerState) {
      return [];
    }

    const allEvents: SorobanEvent[] = [];

    // Query events for each monitored contract
    for (const contractId of this.contractIds) {
      try {
        this.logger.debug(
          `Fetching events for contractId=${contractId} since ledger=${this.indexerState.lastProcessedLedger}`,
        );

        // Call Soroban getEvents RPC method
        // Reference: https://developers.stellar.org/docs/build/smart-contracts/getting-events
        const rpcEvents = await (this.rpcServer as any).getEvents({
          startLedger: this.indexerState.lastProcessedLedger + 1,
          filters: [
            {
              contractIds: [contractId],
            },
          ],
        });

        if (rpcEvents && rpcEvents.events && Array.isArray(rpcEvents.events)) {
          for (const rpcEvent of rpcEvents.events) {
            // Transform RPC event to our format
            const event: SorobanEvent = {
              id: rpcEvent.id,
              ledger: parseInt(rpcEvent.ledger, 10),
              topic: rpcEvent.topic,
              value: rpcEvent.value,
              txHash: rpcEvent.txHash,
            };

            allEvents.push(event);
          }

          this.logger.debug(
            `Fetched ${rpcEvents.events.length} event(s) for contractId=${contractId}`,
          );
        }
      } catch (err) {
        this.logger.warn(
          `Failed to fetch events for contractId=${contractId}: ${(err as Error).message}`,
        );
        // Continue with other contracts on individual failure
      }
    }

    // Sort events by ledger sequence to maintain ordering
    allEvents.sort((a, b) => (a.ledger ?? 0) - (b.ledger ?? 0));

    return allEvents;
  }

  /**
   * Get the current indexer state.
   * Used by health checks to verify indexer is actively processing.
   */
  getIndexerState(): IndexerState | null {
    return this.indexerState;
  }

  /**
   * Get the timestamp of the last processed ledger.
   * Used by health checks to verify indexer is actively processing.
   */
  getLastProcessedTimestamp(): number | null {
    return this.indexerState?.lastProcessedTimestamp ?? null;
  }

  /**
   * Manually trigger contract ID reload (useful for management endpoints).
   */
  async reloadContractIds(): Promise<void> {
    this.logger.log('Manually reloading contract IDs...');
    await this.loadContractIds();
    this.logger.log(`Reloaded ${this.contractIds.size} contract ID(s)`);
  }

  /**
   * Get monitored contract IDs for debugging/monitoring.
   */
  getMonitoredContracts(): string[] {
    return Array.from(this.contractIds);
  }
}
