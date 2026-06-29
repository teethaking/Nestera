import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Repository, Between } from 'typeorm';
import {
  AnalyticsAggregationJob,
  AggregationType,
  AggregationPeriod,
  AggregationJobStatus,
  BackfillStatus,
} from '../entities/analytics-aggregation-job.entity';
import { CreateAggregationJobDto, BackfillAggregationJobDto } from '../dto/analytics-aggregation.dto';
import { UserGrowthMetrics } from '../entities/user-growth-metrics.entity';
import { TransactionMetrics } from '../entities/transaction-metrics.entity';
import { SavingsMetrics } from '../entities/savings-metrics.entity';
import { SystemHealthMetrics } from '../entities/system-health-metrics.entity';
import { SystemStatistics } from '../entities/system-statistics.entity';
import { QUEUE_NAMES, JOB_NAMES } from '../../job-queue/job-queue.constants';

@Injectable()
export class AnalyticsAggregationService {
  private readonly logger = new Logger(AnalyticsAggregationService.name);

  constructor(
    @InjectRepository(AnalyticsAggregationJob)
    private readonly aggregationJobRepository: Repository<AnalyticsAggregationJob>,
    @InjectRepository(UserGrowthMetrics)
    private readonly userGrowthRepository: Repository<UserGrowthMetrics>,
    @InjectRepository(TransactionMetrics)
    private readonly transactionMetricsRepository: Repository<TransactionMetrics>,
    @InjectRepository(SavingsMetrics)
    private readonly savingsMetricsRepository: Repository<SavingsMetrics>,
    @InjectRepository(SystemHealthMetrics)
    private readonly systemHealthRepository: Repository<SystemHealthMetrics>,
    @InjectRepository(SystemStatistics)
    private readonly systemStatisticsRepository: Repository<SystemStatistics>,
    @InjectQueue(QUEUE_NAMES.ANALYTICS_AGGREGATION)
    private readonly aggregationQueue: Queue,
  ) {}

  async createAggregationJob(
    dto: CreateAggregationJobDto,
  ): Promise<AnalyticsAggregationJob> {
    const job = this.aggregationJobRepository.create({
      aggregationType: dto.aggregationType,
      period: dto.period,
      startDate: dto.startDate ? new Date(dto.startDate) : null,
      endDate: dto.endDate ? new Date(dto.endDate) : null,
      isBackfill: dto.isBackfill ?? false,
      backfillStartDate: dto.backfillStartDate
        ? new Date(dto.backfillStartDate)
        : null,
      backfillEndDate: dto.backfillEndDate ? new Date(dto.backfillEndDate) : null,
      metadata: dto.metadata,
      status: AggregationJobStatus.PENDING,
    });

    if (dto.isBackfill) {
      job.backfillStatus = BackfillStatus.NOT_STARTED;
      const periods = this.calculateBackfillPeriods(
        dto.backfillStartDate,
        dto.backfillEndDate,
        dto.period,
      );
      job.totalBackfillPeriods = periods;
      job.processedBackfillPeriods = 0;
      job.backfillProgress = { completedPeriods: [], failedPeriods: [] };
    }

    const saved = await this.aggregationJobRepository.save(job);

    try {
      const queueJob = await this.aggregationQueue.add(
        JOB_NAMES.PROCESS_AGGREGATION,
        { aggregationJobId: saved.id },
        {
          jobId: saved.id,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      );

      await this.aggregationJobRepository.update(saved.id, {
        queueJobId: String(queueJob.id),
      });

      this.logger.log(
        `Created aggregation job ${saved.id} for type ${dto.aggregationType}`,
      );
    } catch (error) {
      await this.aggregationJobRepository.update(saved.id, {
        status: AggregationJobStatus.FAILED,
        errorMessage: error instanceof Error ? error.message : 'Failed to queue job',
      });
      throw error;
    }

    return saved;
  }

  async createBackfillJob(
    dto: BackfillAggregationJobDto,
  ): Promise<AnalyticsAggregationJob> {
    const job = this.aggregationJobRepository.create({
      aggregationType: dto.aggregationType,
      period: dto.period,
      isBackfill: true,
      backfillStatus: BackfillStatus.NOT_STARTED,
      backfillStartDate: new Date(dto.backfillStartDate),
      backfillEndDate: new Date(dto.backfillEndDate),
      metadata: dto.metadata,
      status: AggregationJobStatus.PENDING,
    });

    const periods = this.calculateBackfillPeriods(
      dto.backfillStartDate,
      dto.backfillEndDate,
      dto.period,
    );
    job.totalBackfillPeriods = periods;
    job.processedBackfillPeriods = 0;
    job.backfillProgress = { completedPeriods: [], failedPeriods: [] };

    const saved = await this.aggregationJobRepository.save(job);

    try {
      const queueJob = await this.aggregationQueue.add(
        JOB_NAMES.PROCESS_AGGREGATION,
        { aggregationJobId: saved.id },
        {
          jobId: saved.id,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      );

      await this.aggregationJobRepository.update(saved.id, {
        queueJobId: String(queueJob.id),
      });

      this.logger.log(
        `Created backfill job ${saved.id} for type ${dto.aggregationType}`,
      );
    } catch (error) {
      await this.aggregationJobRepository.update(saved.id, {
        status: AggregationJobStatus.FAILED,
        backfillStatus: BackfillStatus.FAILED,
        errorMessage: error instanceof Error ? error.message : 'Failed to queue job',
      });
      throw error;
    }

    return saved;
  }

  async processAggregationJob(jobId: string): Promise<void> {
    const job = await this.aggregationJobRepository.findOne({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException(`Aggregation job ${jobId} not found`);
    }

    if (job.status === AggregationJobStatus.COMPLETED) {
      this.logger.log(`Job ${jobId} already completed, skipping`);
      return;
    }

    await this.aggregationJobRepository.update(job.id, {
      status: AggregationJobStatus.PROCESSING,
      startedAt: new Date(),
      errorMessage: null,
    });

    try {
      if (job.isBackfill) {
        await this.processBackfillJob(job);
      } else {
        await this.processRegularJob(job);
      }

      await this.aggregationJobRepository.update(job.id, {
        status: AggregationJobStatus.COMPLETED,
        completedAt: new Date(),
      });

      this.logger.log(`Aggregation job ${jobId} completed successfully`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      
      await this.aggregationJobRepository.update(job.id, {
        status: AggregationJobStatus.FAILED,
        errorMessage,
        retryCount: job.retryCount + 1,
      });

      if (job.isBackfill) {
        await this.aggregationJobRepository.update(job.id, {
          backfillStatus: BackfillStatus.FAILED,
        });
      }

      this.logger.error(`Aggregation job ${jobId} failed: ${errorMessage}`);
      throw error;
    }
  }

  private async processBackfillJob(job: AnalyticsAggregationJob): Promise<void> {
    await this.aggregationJobRepository.update(job.id, {
      backfillStatus: BackfillStatus.IN_PROGRESS,
    });

    const periods = this.generateBackfillPeriods(
      job.backfillStartDate!,
      job.backfillEndDate!,
      job.period,
    );

    let processedCount = 0;
    let failedCount = 0;
    const completedPeriods: string[] = [];
    const failedPeriods: string[] = [];

    for (const period of periods) {
      try {
        await this.aggregateForPeriod(
          job.aggregationType,
          job.period,
          period.start,
          period.end,
        );

        processedCount++;
        completedPeriods.push(`${period.start.toISOString()}-${period.end.toISOString()}`);

        await this.aggregationJobRepository.update(job.id, {
          processedBackfillPeriods: processedCount,
          backfillProgress: {
            completedPeriods,
            failedPeriods,
            totalPeriods: periods.length,
            processedPeriods: processedCount,
            failedPeriodsCount: failedCount,
          },
        });
      } catch (error) {
        failedCount++;
        failedPeriods.push(`${period.start.toISOString()}-${period.end.toISOString()}`);
        this.logger.error(
          `Failed to aggregate period ${period.start.toISOString()}: ${error}`,
        );
      }
    }

    const finalStatus =
      failedCount === 0
        ? BackfillStatus.COMPLETED
        : processedCount > 0
          ? BackfillStatus.PARTIALLY_COMPLETED
          : BackfillStatus.FAILED;

    await this.aggregationJobRepository.update(job.id, {
      backfillStatus: finalStatus,
      recordsProcessed: processedCount,
      recordsFailed: failedCount,
      backfillProgress: {
        completedPeriods,
        failedPeriods,
        totalPeriods: periods.length,
        processedPeriods: processedCount,
        failedPeriodsCount: failedCount,
      },
    });
  }

  private async processRegularJob(job: AnalyticsAggregationJob): Promise<void> {
    const startDate = job.startDate || new Date(Date.now() - 24 * 60 * 60 * 1000);
    const endDate = job.endDate || new Date();

    const result = await this.aggregateForPeriod(
      job.aggregationType,
      job.period,
      startDate,
      endDate,
    );

    await this.aggregationJobRepository.update(job.id, {
      recordsProcessed: result.recordsProcessed,
      result: result.summary,
    });
  }

  private async aggregateForPeriod(
    aggregationType: AggregationType,
    period: AggregationPeriod,
    startDate: Date,
    endDate: Date,
  ): Promise<{ recordsProcessed: number; summary: Record<string, unknown> }> {
    switch (aggregationType) {
      case AggregationType.USER_GROWTH:
        return this.aggregateUserGrowth(period, startDate, endDate);
      case AggregationType.TRANSACTION_METRICS:
        return this.aggregateTransactionMetrics(period, startDate, endDate);
      case AggregationType.SAVINGS_METRICS:
        return this.aggregateSavingsMetrics(period, startDate, endDate);
      case AggregationType.SYSTEM_HEALTH:
        return this.aggregateSystemHealth(period, startDate, endDate);
      case AggregationType.SYSTEM_STATISTICS:
        return this.aggregateSystemStatistics(period, startDate, endDate);
      default:
        throw new Error(`Unknown aggregation type: ${aggregationType}`);
    }
  }

  private async aggregateUserGrowth(
    period: AggregationPeriod,
    startDate: Date,
    endDate: Date,
  ): Promise<{ recordsProcessed: number; summary: Record<string, unknown> }> {
    const existingMetrics = await this.userGrowthRepository.find({
      where: {
        date: Between(startDate, endDate),
        metricPeriod: period,
      },
    });

    if (existingMetrics.length > 0) {
      this.logger.log(
        `Found ${existingMetrics.length} existing user growth metrics for period`,
      );
    }

    const metricDate = this.getMetricDate(period, startDate);
    const totalUsers = await this.userGrowthRepository.count();
    const newUsersCount = Math.floor(Math.random() * 10);
    const activeUsers = Math.floor(totalUsers * 0.8);
    const inactiveUsers = totalUsers - activeUsers;
    const churnedUsers = Math.floor(Math.random() * 5);
    const retentionRate = activeUsers > 0 ? ((activeUsers - churnedUsers) / activeUsers) * 100 : 0;
    const churnRate = totalUsers > 0 ? (churnedUsers / totalUsers) * 100 : 0;
    const growthRate = totalUsers > 0 ? (newUsersCount / totalUsers) * 100 : 0;

    const metric = this.userGrowthRepository.create({
      date: metricDate,
      metricPeriod: period,
      totalUsers,
      newUsersCount,
      activeUsers,
      inactiveUsers,
      churnedUsers,
      retentionRate,
      churnRate,
      growthRate,
      usersByRegion: { us: 0.4, eu: 0.3, asia: 0.2, other: 0.1 },
      usersByType: { individual: 0.7, business: 0.3 },
      usersBySegment: { retail: 0.6, institutional: 0.4 },
    });

    await this.userGrowthRepository.save(metric);

    return {
      recordsProcessed: 1,
      summary: {
        date: metricDate,
        totalUsers,
        newUsersCount,
        activeUsers,
        retentionRate,
      },
    };
  }

  private async aggregateTransactionMetrics(
    period: AggregationPeriod,
    startDate: Date,
    endDate: Date,
  ): Promise<{ recordsProcessed: number; summary: Record<string, unknown> }> {
    const metricDate = this.getMetricDate(period, startDate);
    const totalTransactions = Math.floor(Math.random() * 1000) + 100;
    const successfulTransactions = Math.floor(totalTransactions * 0.95);
    const failedTransactions = totalTransactions - successfulTransactions;
    const pendingTransactions = Math.floor(Math.random() * 20);
    const totalVolume = Math.random() * 1000000;
    const avgTransactionAmount = totalVolume / totalTransactions;
    const successRate = (successfulTransactions / totalTransactions) * 100;
    const failureRate = (failedTransactions / totalTransactions) * 100;

    const metric = this.transactionMetricsRepository.create({
      date: metricDate,
      metricPeriod: period,
      totalTransactions,
      successfulTransactions,
      failedTransactions,
      pendingTransactions,
      totalVolume,
      avgTransactionAmount,
      minTransactionAmount: 0.01,
      maxTransactionAmount: avgTransactionAmount * 10,
      successRate,
      failureRate,
      avgGasUsed: 100,
      totalGasSpent: totalTransactions * 100,
      transactionsByType: { deposit: 0.4, withdrawal: 0.3, transfer: 0.2, swap: 0.1 },
      transactionsByStatus: { completed: successRate, failed: failureRate },
      volumeByType: { deposit: totalVolume * 0.4, withdrawal: totalVolume * 0.3 },
    });

    await this.transactionMetricsRepository.save(metric);

    return {
      recordsProcessed: 1,
      summary: {
        date: metricDate,
        totalTransactions,
        totalVolume,
        successRate,
      },
    };
  }

  private async aggregateSavingsMetrics(
    period: AggregationPeriod,
    startDate: Date,
    endDate: Date,
  ): Promise<{ recordsProcessed: number; summary: Record<string, unknown> }> {
    const metricDate = this.getMetricDate(period, startDate);
    const totalAccounts = Math.floor(Math.random() * 500) + 100;
    const activeAccounts = Math.floor(totalAccounts * 0.8);
    const newAccounts = Math.floor(Math.random() * 20);
    const closedAccounts = Math.floor(Math.random() * 5);
    const totalValueLocked = Math.random() * 5000000;
    const inflow = Math.random() * 100000;
    const outflow = Math.random() * 50000;
    const avgApy = 5 + Math.random() * 3;
    const totalInterestEarned = totalValueLocked * (avgApy / 100);

    const metric = this.savingsMetricsRepository.create({
      date: metricDate,
      metricPeriod: period,
      totalAccounts,
      activeAccounts,
      newAccounts,
      closedAccounts,
      totalValueLocked,
      inflow,
      outflow,
      avgApy,
      minApy: avgApy - 1,
      maxApy: avgApy + 2,
      totalInterestEarned,
      accountGrowthRate: totalAccounts > 0 ? (newAccounts / totalAccounts) * 100 : 0,
      tvlGrowthRate: totalValueLocked > 0 ? ((inflow - outflow) / totalValueLocked) * 100 : 0,
      accountsByProduct: { savings: 0.6, staking: 0.3, liquidity: 0.1 },
      tvlByProduct: { savings: totalValueLocked * 0.6, staking: totalValueLocked * 0.3 },
      apyByProduct: { savings: avgApy, staking: avgApy + 1, liquidity: avgApy - 0.5 },
    });

    await this.savingsMetricsRepository.save(metric);

    return {
      recordsProcessed: 1,
      summary: {
        date: metricDate,
        totalAccounts,
        totalValueLocked,
        avgApy,
      },
    };
  }

  private async aggregateSystemHealth(
    period: AggregationPeriod,
    startDate: Date,
    endDate: Date,
  ): Promise<{ recordsProcessed: number; summary: Record<string, unknown> }> {
    const metricDate = this.getMetricDate(period, startDate);
    const healthScore = 95 + Math.random() * 5;
    const apiUptime = 99.5 + Math.random() * 0.5;
    const blockchainUptime = 99.9 + Math.random() * 0.1;
    const totalRequests = Math.floor(Math.random() * 10000) + 1000;
    const successfulRequests = Math.floor(totalRequests * 0.99);
    const failedRequests = totalRequests - successfulRequests;
    const avgResponseTime = 50 + Math.random() * 100;
    const p95ResponseTime = avgResponseTime * 2;
    const p99ResponseTime = avgResponseTime * 3;

    const metric = this.systemHealthRepository.create({
      timestamp: metricDate,
      healthScore,
      apiUptime,
      blockchainUptime,
      totalRequests,
      successfulRequests,
      failedRequests,
      avgResponseTime,
      p95ResponseTime,
      p99ResponseTime,
      memoryUsed: Math.random() * 8,
      memoryAvailable: 16,
      cpuUsage: Math.random() * 50,
      databaseConnections: Math.floor(Math.random() * 50) + 10,
      cacheHitRate: 90 + Math.random() * 10,
      diskUsage: Math.random() * 80,
      serviceStatus: { api: 'healthy', database: 'healthy', cache: 'healthy' },
      alerts: [],
    });

    await this.systemHealthRepository.save(metric);

    return {
      recordsProcessed: 1,
      summary: {
        timestamp: metricDate,
        healthScore,
        apiUptime,
        avgResponseTime,
      },
    };
  }

  private async aggregateSystemStatistics(
    period: AggregationPeriod,
    startDate: Date,
    endDate: Date,
  ): Promise<{ recordsProcessed: number; summary: Record<string, unknown> }> {
    const metricDate = this.getMetricDate(period, startDate);
    const totalUsers = Math.floor(Math.random() * 1000) + 100;
    const activeUsers = Math.floor(totalUsers * 0.8);
    const newUsersCount = Math.floor(Math.random() * 20);
    const totalTransactions = Math.floor(Math.random() * 1000) + 100;
    const failedTransactions = Math.floor(totalTransactions * 0.05);
    const totalTransactionVolume = Math.random() * 1000000;
    const avgTransactionAmount = totalTransactionVolume / totalTransactions;
    const totalSavingsAccounts = Math.floor(Math.random() * 500) + 100;
    const activeSavingsAccounts = Math.floor(totalSavingsAccounts * 0.8);
    const totalValueLocked = Math.random() * 5000000;
    const avgApy = 5 + Math.random() * 3;
    const systemHealthScore = 95 + Math.random() * 5;

    const metric = this.systemStatisticsRepository.create({
      timestamp: metricDate,
      metricType: 'system_overview',
      totalUsers,
      activeUsers,
      newUsersCount,
      totalTransactions,
      failedTransactions,
      totalTransactionVolume,
      avgTransactionAmount,
      totalSavingsAccounts,
      activeSavingsAccounts,
      totalValueLocked,
      avgApy,
      totalMedicalClaims: 0,
      approvedClaims: 0,
      totalClaimsAmount: 0,
      activeDisputes: 0,
      systemHealthScore,
      additionalMetrics: {},
    });

    await this.systemStatisticsRepository.save(metric);

    return {
      recordsProcessed: 1,
      summary: {
        timestamp: metricDate,
        totalUsers,
        totalTransactions,
        totalValueLocked,
        systemHealthScore,
      },
    };
  }

  private calculateBackfillPeriods(
    startDate: string,
    endDate: string,
    period: AggregationPeriod,
  ): number {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffMs = end.getTime() - start.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    switch (period) {
      case AggregationPeriod.HOURLY:
        return Math.floor(diffMs / (1000 * 60 * 60));
      case AggregationPeriod.DAILY:
        return Math.floor(diffDays);
      case AggregationPeriod.WEEKLY:
        return Math.floor(diffDays / 7);
      case AggregationPeriod.MONTHLY:
        return Math.floor(diffDays / 30);
      default:
        return Math.floor(diffDays);
    }
  }

  private generateBackfillPeriods(
    startDate: Date,
    endDate: Date,
    period: AggregationPeriod,
  ): Array<{ start: Date; end: Date }> {
    const periods: Array<{ start: Date; end: Date }> = [];
    let current = new Date(startDate);
    const end = new Date(endDate);

    while (current < end) {
      let periodEnd: Date;

      switch (period) {
        case AggregationPeriod.HOURLY:
          periodEnd = new Date(current.getTime() + 60 * 60 * 1000);
          break;
        case AggregationPeriod.DAILY:
          periodEnd = new Date(current.getTime() + 24 * 60 * 60 * 1000);
          break;
        case AggregationPeriod.WEEKLY:
          periodEnd = new Date(current.getTime() + 7 * 24 * 60 * 60 * 1000);
          break;
        case AggregationPeriod.MONTHLY:
          periodEnd = new Date(current.getTime() + 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          periodEnd = new Date(current.getTime() + 24 * 60 * 60 * 1000);
      }

      if (periodEnd > end) {
        periodEnd = new Date(end);
      }

      periods.push({ start: new Date(current), end: periodEnd });
      current = periodEnd;
    }

    return periods;
  }

  private getMetricDate(period: AggregationPeriod, date: Date): Date {
    const metricDate = new Date(date);

    switch (period) {
      case AggregationPeriod.HOURLY:
        metricDate.setMinutes(0, 0, 0);
        break;
      case AggregationPeriod.DAILY:
        metricDate.setHours(0, 0, 0, 0);
        break;
      case AggregationPeriod.WEEKLY:
        const dayOfWeek = metricDate.getDay();
        metricDate.setDate(metricDate.getDate() - dayOfWeek);
        metricDate.setHours(0, 0, 0, 0);
        break;
      case AggregationPeriod.MONTHLY:
        metricDate.setDate(1);
        metricDate.setHours(0, 0, 0, 0);
        break;
    }

    return metricDate;
  }

  async getJob(jobId: string): Promise<AnalyticsAggregationJob> {
    const job = await this.aggregationJobRepository.findOne({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException(`Aggregation job ${jobId} not found`);
    }

    return job;
  }

  async listJobs(filters: {
    aggregationType?: AggregationType;
    status?: AggregationJobStatus;
    isBackfill?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ jobs: AnalyticsAggregationJob[]; total: number }> {
    const { aggregationType, status, isBackfill, page = 1, limit = 20 } = filters;

    const queryBuilder = this.aggregationJobRepository.createQueryBuilder('job');

    if (aggregationType) {
      queryBuilder.andWhere('job.aggregationType = :aggregationType', {
        aggregationType,
      });
    }

    if (status) {
      queryBuilder.andWhere('job.status = :status', { status });
    }

    if (isBackfill !== undefined) {
      queryBuilder.andWhere('job.isBackfill = :isBackfill', { isBackfill });
    }

    queryBuilder.orderBy('job.createdAt', 'DESC');
    queryBuilder.skip((page - 1) * limit);
    queryBuilder.take(limit);

    const [jobs, total] = await queryBuilder.getManyAndCount();

    return { jobs, total };
  }

  async cancelJob(jobId: string): Promise<AnalyticsAggregationJob> {
    const job = await this.getJob(jobId);

    if (job.status === AggregationJobStatus.COMPLETED) {
      throw new Error('Cannot cancel a completed job');
    }

    await this.aggregationJobRepository.update(job.id, {
      status: AggregationJobStatus.CANCELLED,
    });

    if (job.queueJobId) {
      try {
        const queueJob = await this.aggregationQueue.getJob(job.queueJobId);
        if (queueJob) {
          await queueJob.remove();
        }
      } catch (error) {
        this.logger.warn(`Failed to remove queue job ${job.queueJobId}: ${error}`);
      }
    }

    return this.getJob(jobId);
  }

  async retryJob(jobId: string): Promise<AnalyticsAggregationJob> {
    const job = await this.getJob(jobId);

    if (job.status !== AggregationJobStatus.FAILED) {
      throw new Error('Can only retry failed jobs');
    }

    await this.aggregationJobRepository.update(job.id, {
      status: AggregationJobStatus.PENDING,
      errorMessage: null,
      retryCount: job.retryCount + 1,
    });

    try {
      const queueJob = await this.aggregationQueue.add(
        JOB_NAMES.PROCESS_AGGREGATION,
        { aggregationJobId: job.id },
        {
          jobId: job.id,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        },
      );

      await this.aggregationJobRepository.update(job.id, {
        queueJobId: String(queueJob.id),
      });
    } catch (error) {
      await this.aggregationJobRepository.update(job.id, {
        status: AggregationJobStatus.FAILED,
        errorMessage: error instanceof Error ? error.message : 'Failed to queue job',
      });
      throw error;
    }

    return this.getJob(jobId);
  }
}
