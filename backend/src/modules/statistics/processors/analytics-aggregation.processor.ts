import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { QUEUE_NAMES, JOB_NAMES } from '../../job-queue/job-queue.constants';
import { AnalyticsAggregationService } from '../services/analytics-aggregation.service';

@Injectable()
@Processor(QUEUE_NAMES.ANALYTICS_AGGREGATION)
export class AnalyticsAggregationProcessor {
  private readonly logger = new Logger(AnalyticsAggregationProcessor.name);

  constructor(
    private readonly analyticsAggregationService: AnalyticsAggregationService,
  ) {}

  @Process(JOB_NAMES.PROCESS_AGGREGATION)
  async handle(job: Job<{ aggregationJobId: string }>): Promise<void> {
    const { aggregationJobId } = job.data;
    this.logger.log(`Processing aggregation job ${aggregationJobId}`);

    try {
      await this.analyticsAggregationService.processAggregationJob(
        aggregationJobId,
      );
      this.logger.log(`Successfully processed aggregation job ${aggregationJobId}`);
    } catch (error) {
      this.logger.error(
        `Failed to process aggregation job ${aggregationJobId}: ${error}`,
      );
      throw error;
    }
  }
}
