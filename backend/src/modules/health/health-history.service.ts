import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository, LessThan, MoreThanOrEqual } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HealthCheckRecord } from './entities/health-check-record.entity';
import { ShutdownTrackedTask } from '../../common/decorators/shutdown-task.decorator';

export interface HealthCheckResult {
  service: string;
  status: 'up' | 'down' | 'degraded';
  responseTime: number;
  timestamp: Date;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface HealthHistoryQuery {
  service?: string;
  limit?: number;
  from?: Date;
  to?: Date;
}

@Injectable()
export class HealthHistoryService {
  private readonly logger = new Logger(HealthHistoryService.name);
  private readonly retentionDays: number;

  constructor(
    @InjectRepository(HealthCheckRecord)
    private readonly recordRepo: Repository<HealthCheckRecord>,
    private readonly configService: ConfigService,
  ) {
    this.retentionDays = this.configService.get<number>(
      'health.retentionDays',
      30,
    );
  }

  async recordCheck(result: HealthCheckResult): Promise<void> {
    const record = this.recordRepo.create({
      service: result.service,
      status: result.status,
      responseTime: result.responseTime,
      error: result.error ?? null,
      metadata: result.metadata ?? null,
      checkedAt: result.timestamp,
    });
    await this.recordRepo.save(record);
  }

  async recordChecks(results: HealthCheckResult[]): Promise<void> {
    if (results.length === 0) return;

    const records = results.map((result) =>
      this.recordRepo.create({
        service: result.service,
        status: result.status,
        responseTime: result.responseTime,
        error: result.error ?? null,
        metadata: result.metadata ?? null,
        checkedAt: result.timestamp,
      }),
    );
    await this.recordRepo.save(records);
  }

  async getHistory(query: HealthHistoryQuery): Promise<HealthCheckRecord[]> {
    const limit = query.limit ?? 100;
    const qb = this.recordRepo
      .createQueryBuilder('record')
      .orderBy('record.checkedAt', 'DESC')
      .take(limit);

    if (query.service) {
      qb.andWhere('record.service = :service', { service: query.service });
    }

    if (query.from && query.to) {
      qb.andWhere('record.checkedAt BETWEEN :from AND :to', {
        from: query.from,
        to: query.to,
      });
    } else if (query.from) {
      qb.andWhere('record.checkedAt >= :from', { from: query.from });
    } else if (query.to) {
      qb.andWhere('record.checkedAt <= :to', { to: query.to });
    }

    return qb.getMany();
  }

  async getServiceStats(service: string) {
    const serviceHistory = await this.recordRepo.find({
      where: { service },
      order: { checkedAt: 'DESC' },
      take: 1000,
    });

    if (serviceHistory.length === 0) {
      return null;
    }

    const upCount = serviceHistory.filter((h) => h.status === 'up').length;
    const downCount = serviceHistory.filter((h) => h.status === 'down').length;
    const avgResponseTime =
      serviceHistory.reduce((sum, h) => sum + h.responseTime, 0) /
      serviceHistory.length;

    const last = serviceHistory[0];

    return {
      service,
      totalChecks: serviceHistory.length,
      uptime: ((upCount / serviceHistory.length) * 100).toFixed(2) + '%',
      downtime: ((downCount / serviceHistory.length) * 100).toFixed(2) + '%',
      avgResponseTime: `${avgResponseTime.toFixed(2)}ms`,
      lastCheck: {
        service: last.service,
        status: last.status,
        responseTime: last.responseTime,
        timestamp: last.checkedAt,
        error: last.error ?? undefined,
      },
    };
  }

  async getAllStats() {
    const services = await this.recordRepo
      .createQueryBuilder('record')
      .select('DISTINCT record.service', 'service')
      .getRawMany<{ service: string }>();

    const stats: Record<string, Awaited<ReturnType<typeof this.getServiceStats>>> = {};

    for (const { service } of services) {
      stats[service] = await this.getServiceStats(service);
    }

    return stats;
  }

  async getVisualizationData(hours = 24) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const records = await this.recordRepo.find({
      where: { checkedAt: MoreThanOrEqual(since) },
      order: { checkedAt: 'ASC' },
    });

    const byService: Record<
      string,
      { timestamps: string[]; statuses: string[]; responseTimes: number[] }
    > = {};

    for (const record of records) {
      if (!byService[record.service]) {
        byService[record.service] = {
          timestamps: [],
          statuses: [],
          responseTimes: [],
        };
      }
      byService[record.service].timestamps.push(record.checkedAt.toISOString());
      byService[record.service].statuses.push(record.status);
      byService[record.service].responseTimes.push(record.responseTime);
    }

    const overallUp = records.filter((r) => r.status === 'up').length;
    const overallTotal = records.length;

    return {
      periodHours: hours,
      retentionDays: this.retentionDays,
      totalRecords: records.length,
      overallUptime:
        overallTotal > 0
          ? ((overallUp / overallTotal) * 100).toFixed(2) + '%'
          : 'N/A',
      services: byService,
      generatedAt: new Date().toISOString(),
    };
  }

  @ShutdownTrackedTask()
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async enforceRetentionPolicy(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - this.retentionDays);

    const result = await this.recordRepo.delete({
      checkedAt: LessThan(cutoff),
    });

    if (result.affected && result.affected > 0) {
      this.logger.log(
        `Purged ${result.affected} health records older than ${this.retentionDays} days`,
      );
    }
  }
}
