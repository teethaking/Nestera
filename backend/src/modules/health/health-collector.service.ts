import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TypeOrmHealthIndicator } from './indicators/typeorm.health';
import { IndexerHealthIndicator } from './indicators/indexer.health';
import { RpcHealthIndicator } from './indicators/rpc.health';
import {
  RedisHealthIndicator,
  EmailServiceHealthIndicator,
  SorobanRpcHealthIndicator,
  HorizonHealthIndicator,
} from './indicators/external-services.health';
import { StorageHealthIndicator } from './indicators/storage.health';
import { SystemHealthIndicator } from './indicators/system.health';
import { HealthHistoryService } from './health-history.service';
import { ShutdownTrackedTask } from '../../common/decorators/shutdown-task.decorator';

@Injectable()
export class HealthCollectorService {
  private readonly logger = new Logger(HealthCollectorService.name);

  private readonly indicators: Array<{
    name: string;
    check: () => Promise<Record<string, unknown>>;
  }>;

  constructor(
    private readonly db: TypeOrmHealthIndicator,
    private readonly rpc: RpcHealthIndicator,
    private readonly indexer: IndexerHealthIndicator,
    private readonly redis: RedisHealthIndicator,
    private readonly email: EmailServiceHealthIndicator,
    private readonly sorobanRpc: SorobanRpcHealthIndicator,
    private readonly horizon: HorizonHealthIndicator,
    private readonly storage: StorageHealthIndicator,
    private readonly system: SystemHealthIndicator,
    private readonly healthHistory: HealthHistoryService,
  ) {
    this.indicators = [
      { name: 'database', check: () => this.db.isHealthy('database') },
      { name: 'rpc', check: () => this.rpc.isHealthy('rpc') },
      { name: 'indexer', check: () => this.indexer.isHealthy('indexer') },
      { name: 'redis', check: () => this.redis.isHealthy('redis') },
      { name: 'email', check: () => this.email.isHealthy('email') },
      { name: 'soroban-rpc', check: () => this.sorobanRpc.isHealthy('soroban-rpc') },
      { name: 'horizon', check: () => this.horizon.isHealthy('horizon') },
      { name: 'storage', check: () => this.storage.isHealthy('storage') },
      { name: 'system', check: () => this.system.isHealthy('system') },
    ];
  }

  @ShutdownTrackedTask()
  @Cron(CronExpression.EVERY_MINUTE)
  async collectHealthSnapshots(): Promise<void> {
    try {
      const results = await this.runChecks();
      await this.healthHistory.recordChecks(results);
    } catch (error) {
      this.logger.error(
        `Health snapshot collection failed: ${(error as Error).message}`,
      );
    }
  }

  async runChecks() {
    const timestamp = new Date();
    const results = await Promise.allSettled(
      this.indicators.map(async ({ name, check }) => {
        const start = Date.now();
        try {
          const value = await check();
          const entry = value[name] as Record<string, unknown> | undefined;
          const status = (entry?.status as string) ?? 'up';
          return {
            service: name,
            status: (status === 'up' ? 'up' : status === 'degraded' ? 'degraded' : 'down') as
              | 'up'
              | 'down'
              | 'degraded',
            responseTime: Date.now() - start,
            timestamp,
            error: entry?.message as string | undefined,
          };
        } catch (err) {
          return {
            service: name,
            status: 'down' as const,
            responseTime: Date.now() - start,
            timestamp,
            error: (err as Error).message,
          };
        }
      }),
    );

    return results.map((r, i) =>
      r.status === 'fulfilled'
        ? r.value
        : {
            service: this.indicators[i].name,
            status: 'down' as const,
            responseTime: 0,
            timestamp,
            error: (r.reason as Error)?.message ?? 'Unknown error',
          },
    );
  }
}
