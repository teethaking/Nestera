import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum AggregationType {
  USER_GROWTH = 'user_growth',
  TRANSACTION_METRICS = 'transaction_metrics',
  SAVINGS_METRICS = 'savings_metrics',
  SYSTEM_HEALTH = 'system_health',
  SYSTEM_STATISTICS = 'system_statistics',
}

export enum AggregationPeriod {
  HOURLY = 'hourly',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
}

export enum AggregationJobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum BackfillStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  PARTIALLY_COMPLETED = 'partially_completed',
}

@Entity('analytics_aggregation_jobs')
@Index(['aggregationType', 'status'])
@Index(['createdAt'])
@Index(['isBackfill', 'backfillStatus'])
export class AnalyticsAggregationJob {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 32 })
  aggregationType!: AggregationType;

  @Column({ type: 'varchar', length: 16 })
  period!: AggregationPeriod;

  @Column({
    type: 'varchar',
    length: 32,
    default: AggregationJobStatus.PENDING,
  })
  status!: AggregationJobStatus;

  @Column({ type: 'timestamp', nullable: true })
  startDate?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  endDate?: Date | null;

  @Column({ type: 'boolean', default: false })
  isBackfill!: boolean;

  @Column({
    type: 'varchar',
    length: 32,
    nullable: true,
  })
  backfillStatus?: BackfillStatus | null;

  @Column({ type: 'timestamp', nullable: true })
  backfillStartDate?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  backfillEndDate?: Date | null;

  @Column({ type: 'int', nullable: true })
  totalBackfillPeriods?: number | null;

  @Column({ type: 'int', nullable: true })
  processedBackfillPeriods?: number | null;

  @Column({ type: 'jsonb', nullable: true })
  backfillProgress?: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  queueJobId?: string | null;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  result?: Record<string, unknown> | null;

  @Column({ type: 'timestamp', nullable: true })
  startedAt?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date | null;

  @Column({ type: 'int', nullable: true })
  recordsProcessed?: number | null;

  @Column({ type: 'int', nullable: true })
  recordsFailed?: number | null;

  @Column({ type: 'int', default: 0 })
  retryCount!: number;

  @Column({ type: 'timestamp', nullable: true })
  nextRetryAt?: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
