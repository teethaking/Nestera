import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';
import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './services/statistics.service';
import { StatisticsAggregationService } from './services/statistics-aggregation.service';
import { StatisticsUtilsService } from './services/statistics-utils.service';
import { AnalyticsExportService } from './services/analytics-export.service';
import { AnalyticsAggregationService } from './services/analytics-aggregation.service';
import { AnalyticsExportProcessor } from './processors/analytics-export.processor';
import { AnalyticsAggregationProcessor } from './processors/analytics-aggregation.processor';
import { AnalyticsAggregationController } from './controllers/analytics-aggregation.controller';
import { SystemStatistics } from './entities/system-statistics.entity';
import { UserGrowthMetrics } from './entities/user-growth-metrics.entity';
import { TransactionMetrics } from './entities/transaction-metrics.entity';
import { SavingsMetrics } from './entities/savings-metrics.entity';
import { SystemHealthMetrics } from './entities/system-health-metrics.entity';
import { AnalyticsExportJob } from './entities/analytics-export-job.entity';
import { AnalyticsAggregationJob } from './entities/analytics-aggregation-job.entity';
import { User } from '../user/entities/user.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { UserSubscription } from '../savings/entities/user-subscription.entity';
import { ANALYTICS_EXPORT_QUEUE } from './statistics-export.constants';
import { QUEUE_NAMES } from '../job-queue/job-queue.constants';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SystemStatistics,
      UserGrowthMetrics,
      TransactionMetrics,
      SavingsMetrics,
      SystemHealthMetrics,
      AnalyticsExportJob,
      AnalyticsAggregationJob,
      User,
      Transaction,
      UserSubscription,
    ]),
    BullModule.registerQueue(
      { name: ANALYTICS_EXPORT_QUEUE },
      {
        name: QUEUE_NAMES.ANALYTICS_AGGREGATION,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      },
    ),
    CacheModule.register({
      ttl: 300, // 5 minutes default TTL
      max: 1000, // Maximum number of cached items
    }),
    ScheduleModule.forRoot(),
  ],
  controllers: [StatisticsController, AnalyticsAggregationController],
  providers: [
    StatisticsService,
    StatisticsAggregationService,
    StatisticsUtilsService,
    AnalyticsExportService,
    AnalyticsExportProcessor,
    AnalyticsAggregationProcessor,
  ],
  exports: [StatisticsService, StatisticsUtilsService, AnalyticsExportService, AnalyticsAggregationService],
})
export class StatisticsModule {}
