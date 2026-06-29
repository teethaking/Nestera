import { IsEnum, IsOptional, IsDateString, IsBoolean, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AggregationType,
  AggregationPeriod,
  AggregationJobStatus,
  BackfillStatus,
} from '../entities/analytics-aggregation-job.entity';

export class CreateAggregationJobDto {
  @ApiProperty({
    enum: AggregationType,
    description: 'Type of aggregation to perform',
  })
  @IsEnum(AggregationType)
  aggregationType: AggregationType;

  @ApiProperty({
    enum: AggregationPeriod,
    description: 'Time period for aggregation',
  })
  @IsEnum(AggregationPeriod)
  period: AggregationPeriod;

  @ApiPropertyOptional({
    description: 'Start date for aggregation (ISO string)',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date for aggregation (ISO string)',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Whether this is a backfill operation',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isBackfill?: boolean;

  @ApiPropertyOptional({
    description: 'Backfill start date (ISO string)',
  })
  @IsOptional()
  @IsDateString()
  backfillStartDate?: string;

  @ApiPropertyOptional({
    description: 'Backfill end date (ISO string)',
  })
  @IsOptional()
  @IsDateString()
  backfillEndDate?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata for the job',
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class BackfillAggregationJobDto {
  @ApiProperty({
    enum: AggregationType,
    description: 'Type of aggregation to backfill',
  })
  @IsEnum(AggregationType)
  aggregationType: AggregationType;

  @ApiProperty({
    enum: AggregationPeriod,
    description: 'Time period for aggregation',
  })
  @IsEnum(AggregationPeriod)
  period: AggregationPeriod;

  @ApiProperty({
    description: 'Backfill start date (ISO string)',
  })
  @IsDateString()
  backfillStartDate: string;

  @ApiProperty({
    description: 'Backfill end date (ISO string)',
  })
  @IsDateString()
  backfillEndDate: string;

  @ApiPropertyOptional({
    description: 'Additional metadata for the backfill',
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class AggregationJobResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: AggregationType })
  aggregationType: AggregationType;

  @ApiProperty({ enum: AggregationPeriod })
  period: AggregationPeriod;

  @ApiProperty({ enum: AggregationJobStatus })
  status: AggregationJobStatus;

  @ApiPropertyOptional()
  startDate?: Date;

  @ApiPropertyOptional()
  endDate?: Date;

  @ApiProperty()
  isBackfill: boolean;

  @ApiPropertyOptional({ enum: BackfillStatus })
  backfillStatus?: BackfillStatus;

  @ApiPropertyOptional()
  backfillStartDate?: Date;

  @ApiPropertyOptional()
  backfillEndDate?: Date;

  @ApiPropertyOptional()
  totalBackfillPeriods?: number;

  @ApiPropertyOptional()
  processedBackfillPeriods?: number;

  @ApiPropertyOptional()
  backfillProgress?: Record<string, unknown>;

  @ApiPropertyOptional()
  errorMessage?: string;

  @ApiPropertyOptional()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional()
  result?: Record<string, unknown>;

  @ApiPropertyOptional()
  startedAt?: Date;

  @ApiPropertyOptional()
  completedAt?: Date;

  @ApiPropertyOptional()
  recordsProcessed?: number;

  @ApiPropertyOptional()
  recordsFailed?: number;

  @ApiProperty()
  retryCount: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class AggregationJobListQueryDto {
  @ApiPropertyOptional({ enum: AggregationType })
  @IsOptional()
  @IsEnum(AggregationType)
  aggregationType?: AggregationType;

  @ApiPropertyOptional({ enum: AggregationJobStatus })
  @IsOptional()
  @IsEnum(AggregationJobStatus)
  status?: AggregationJobStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isBackfill?: boolean;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  limit?: number;
}
