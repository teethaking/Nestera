import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobQueueService } from '../job-queue/job-queue.service';
import { QUEUE_NAMES } from '../job-queue/job-queue.constants';

export interface BackpressureStatus {
  paused: boolean;
  queueDepth: number;
  maxQueueDepth: number;
  ingestionRatePerSecond: number;
  maxIngestionRatePerSecond: number;
  workerConcurrency: number;
  lastPauseAt: string | null;
}

@Injectable()
export class EventStreamBackpressureService {
  private readonly logger = new Logger(EventStreamBackpressureService.name);

  private readonly maxQueueDepth: number;
  private readonly maxIngestionRatePerSecond: number;
  private readonly workerConcurrency: number;

  private paused = false;
  private lastPauseAt: Date | null = null;
  private ingestionTimestamps: number[] = [];

  constructor(
    private readonly configService: ConfigService,
    private readonly jobQueueService: JobQueueService,
  ) {
    this.maxQueueDepth = this.configService.get<number>(
      'eventStream.maxQueueDepth',
      1000,
    );
    this.maxIngestionRatePerSecond = this.configService.get<number>(
      'eventStream.maxIngestionRatePerSecond',
      100,
    );
    this.workerConcurrency = this.configService.get<number>(
      'eventStream.workerConcurrency',
      5,
    );
  }

  getWorkerConcurrency(): number {
    return this.workerConcurrency;
  }

  isPaused(): boolean {
    return this.paused;
  }

  async getStatus(): Promise<BackpressureStatus> {
    const queueStatus = await this.jobQueueService.getQueueStatus(
      QUEUE_NAMES.BLOCKCHAIN,
    );
    const queueDepth =
      (queueStatus?.waiting ?? 0) + (queueStatus?.active ?? 0);

    return {
      paused: this.paused,
      queueDepth,
      maxQueueDepth: this.maxQueueDepth,
      ingestionRatePerSecond: this.getCurrentIngestionRate(),
      maxIngestionRatePerSecond: this.maxIngestionRatePerSecond,
      workerConcurrency: this.workerConcurrency,
      lastPauseAt: this.lastPauseAt?.toISOString() ?? null,
    };
  }

  async shouldPauseIngestion(): Promise<boolean> {
    const status = await this.getStatus();

    if (status.queueDepth >= this.maxQueueDepth) {
      if (!this.paused) {
        this.paused = true;
        this.lastPauseAt = new Date();
        this.logger.warn(
          `Backpressure: pausing ingestion (queue depth ${status.queueDepth}/${this.maxQueueDepth})`,
        );
      }
      return true;
    }

    if (this.paused && status.queueDepth < this.maxQueueDepth * 0.5) {
      this.paused = false;
      this.logger.log(
        `Backpressure: resuming ingestion (queue depth ${status.queueDepth})`,
      );
    }

    return this.paused;
  }

  canIngestEvents(count: number): boolean {
    const now = Date.now();
    this.ingestionTimestamps = this.ingestionTimestamps.filter(
      (ts) => now - ts < 1000,
    );

    if (
      this.ingestionTimestamps.length + count >
      this.maxIngestionRatePerSecond
    ) {
      this.logger.debug(
        `Ingestion rate limit hit: ${this.ingestionTimestamps.length}/${this.maxIngestionRatePerSecond} per second`,
      );
      return false;
    }

    for (let i = 0; i < count; i++) {
      this.ingestionTimestamps.push(now);
    }
    return true;
  }

  private getCurrentIngestionRate(): number {
    const now = Date.now();
    return this.ingestionTimestamps.filter((ts) => now - ts < 1000).length;
  }
}
