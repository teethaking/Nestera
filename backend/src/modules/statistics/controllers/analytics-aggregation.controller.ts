import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { AnalyticsAggregationService } from '../services/analytics-aggregation.service';
import {
  CreateAggregationJobDto,
  BackfillAggregationJobDto,
  AggregationJobResponseDto,
  AggregationJobListQueryDto,
} from '../dto/analytics-aggregation.dto';
import { AnalyticsAggregationJob } from '../entities/analytics-aggregation-job.entity';

@ApiTags('Analytics Aggregation')
@Controller('analytics/aggregation')
export class AnalyticsAggregationController {
  constructor(
    private readonly analyticsAggregationService: AnalyticsAggregationService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new analytics aggregation job' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Aggregation job created successfully',
    type: AnalyticsAggregationJob,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid request data',
  })
  async createAggregationJob(
    @Body() dto: CreateAggregationJobDto,
  ): Promise<AnalyticsAggregationJob> {
    return this.analyticsAggregationService.createAggregationJob(dto);
  }

  @Post('backfill')
  @ApiOperation({ summary: 'Create a backfill job for historical data' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Backfill job created successfully',
    type: AnalyticsAggregationJob,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid request data',
  })
  async createBackfillJob(
    @Body() dto: BackfillAggregationJobDto,
  ): Promise<AnalyticsAggregationJob> {
    return this.analyticsAggregationService.createBackfillJob(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List aggregation jobs with optional filters' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of aggregation jobs',
    schema: {
      type: 'object',
      properties: {
        jobs: { type: 'array', items: { $ref: '#/components/schemas/AnalyticsAggregationJob' } },
        total: { type: 'number' },
      },
    },
  })
  @ApiQuery({
    name: 'aggregationType',
    required: false,
    enum: ['user_growth', 'transaction_metrics', 'savings_metrics', 'system_health', 'system_statistics'],
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
  })
  @ApiQuery({ name: 'isBackfill', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async listJobs(
    @Query() query: AggregationJobListQueryDto,
  ): Promise<{ jobs: AnalyticsAggregationJob[]; total: number }> {
    return this.analyticsAggregationService.listJobs(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific aggregation job by ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Aggregation job details',
    type: AnalyticsAggregationJob,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Aggregation job not found',
  })
  @ApiParam({ name: 'id', description: 'Aggregation job ID' })
  async getJob(@Param('id') id: string): Promise<AnalyticsAggregationJob> {
    return this.analyticsAggregationService.getJob(id);
  }

  @Post(':id/retry')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Retry a failed aggregation job' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Job queued for retry',
    type: AnalyticsAggregationJob,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Cannot retry job (not in failed state)',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Aggregation job not found',
  })
  @ApiParam({ name: 'id', description: 'Aggregation job ID' })
  async retryJob(@Param('id') id: string): Promise<AnalyticsAggregationJob> {
    return this.analyticsAggregationService.retryJob(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a pending or processing aggregation job' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Job cancelled successfully',
    type: AnalyticsAggregationJob,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Cannot cancel job (already completed)',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Aggregation job not found',
  })
  @ApiParam({ name: 'id', description: 'Aggregation job ID' })
  async cancelJob(@Param('id') id: string): Promise<AnalyticsAggregationJob> {
    return this.analyticsAggregationService.cancelJob(id);
  }
}
