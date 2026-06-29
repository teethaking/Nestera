 import { Injectable, Logger } from '@nestjs/common';
import { CacheStrategyService } from './cache-strategy.service';
import { Cron, CronExpression } from '@nestjs/schedule';

export enum CachePriority {
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
  CRITICAL = 4,
}

export interface CacheableEndpoint {
  key: string;
  priority: CachePriority;
  loader: () => Promise<any>;
  ttl?: number;
}

@Injectable()
export class CacheWarmingService {
  private readonly logger = new Logger(CacheWarmingService.name);
  private cacheableEndpoints: CacheableEndpoint[] = [];
  private warmingMetrics = {
    totalWarmed: 0,
    successCount: 0,
    failureCount: 0,
    lastWarmedAt: null as Date | null,
    warmingDuration: 0,
  };

  constructor(private readonly cacheStrategy: CacheStrategyService) {}

  registerCacheableEndpoint(endpoint: CacheableEndpoint): void {
    this.cacheableEndpoints.push(endpoint);
    this.logger.log(`Registered cacheable endpoint: ${endpoint.key}`);
  }

  private warmRunInProgress = false;

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Cache warm timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      promise
        .then((v) => {
          clearTimeout(timer);
          resolve(v);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  private async warmEndpoint(endpoint: CacheableEndpoint): Promise<void> {
    try {
      await this.withTimeout(
        this.cacheStrategy.warmCache(
          endpoint.key,
          endpoint.loader,
          endpoint.ttl,
        ),
        10_000,
      );
      this.warmingMetrics.successCount++;
    } catch (error) {
      this.warmingMetrics.failureCount++;
      this.logger.error(`Failed to warm endpoint ${endpoint.key}:`, error);
    }
  }

  async warmAllEndpoints(): Promise<void> {
    const startTime = Date.now();

    if (this.warmRunInProgress) {
      this.logger.log(
        'Cache warming already in progress; skipping overlapping warmAllEndpoints()',
      );
      return;
    }

    this.warmRunInProgress = true;
    this.logger.log('Starting cache warming...');

    try {
      const sortedEndpoints = [...this.cacheableEndpoints].sort(
        (a, b) => b.priority - a.priority,
      );

      // Concurrency policy (higher priority first with more parallelism)
      const priorityGroups: CachePriority[] = [
        CachePriority.CRITICAL,
        CachePriority.HIGH,
        CachePriority.MEDIUM,
        CachePriority.LOW,
      ];

      const loadersByPriority = priorityGroups.map((p) =>
        sortedEndpoints.filter((e) => e.priority === p),
      );

      for (let i = 0; i < priorityGroups.length; i++) {
        const group = loadersByPriority[i];
        if (group.length === 0) continue;

        const groupPriority = priorityGroups[i];
        const concurrency =
          groupPriority === CachePriority.CRITICAL
            ? 8
            : groupPriority === CachePriority.HIGH
              ? 4
              : groupPriority === CachePriority.MEDIUM
                ? 2
                : 1;

        await this.runPool(group, concurrency);
      }

      const duration = Date.now() - startTime;
      this.warmingMetrics.warmingDuration = duration;
      this.warmingMetrics.lastWarmedAt = new Date();
      this.warmingMetrics.totalWarmed += sortedEndpoints.length;
      this.logger.log(`Cache warming completed in ${duration}ms`);
    } catch (error) {
      this.logger.error('Cache warming failed:', error);
    } finally {
      this.warmRunInProgress = false;
    }
  }

  private async runPool(
    endpoints: CacheableEndpoint[],
    concurrency: number,
  ): Promise<void> {
    const queue = [...endpoints];
    const workers = Array.from({ length: concurrency }).map(async () => {
      while (queue.length > 0) {
        const next = queue.shift();
        if (!next) return;
        await this.warmEndpoint(next);
      }
    });

    await Promise.all(workers);
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  handleScheduledWarmup(): void {
    this.warmAllEndpoints();
  }

  getWarmingMetrics() {
    return {
      ...this.warmingMetrics,
      successRate:
        this.warmingMetrics.totalWarmed > 0
          ? (
              (this.warmingMetrics.successCount /
                this.warmingMetrics.totalWarmed) *
              100
            ).toFixed(2) + '%'
          : '0%',
    };
  }

  getRegisteredEndpoints(): CacheableEndpoint[] {
    return this.cacheableEndpoints;
  }
}
