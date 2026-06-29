import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum ReplayJobStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum ReplayJobMode {
  LEDGER_RANGE = 'ledger_range',
  EVENT_CURSOR = 'event_cursor',
}

@Entity('blockchain_replay_jobs')
@Index(['status'])
@Index(['createdAt'])
export class BlockchainReplayJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: ReplayJobMode })
  mode: ReplayJobMode;

  @Column({
    type: 'enum',
    enum: ReplayJobStatus,
    default: ReplayJobStatus.PENDING,
  })
  status: ReplayJobStatus;

  @Column({ type: 'bigint', nullable: true })
  startLedger: number | null;

  @Column({ type: 'bigint', nullable: true })
  endLedger: number | null;

  @Column({ type: 'varchar', length: 128, nullable: true })
  eventCursor: string | null;

  @Column({ type: 'int', default: 0 })
  eventsProcessed: number;

  @Column({ type: 'int', default: 0 })
  eventsFailed: number;

  @Column({ type: 'int', default: 0 })
  eventsSkipped: number;

  @Column({ type: 'int', default: 0 })
  totalEvents: number;

  @Column({ type: 'varchar', length: 128, nullable: true })
  lockOwnerId: string | null;

  @Column({ type: 'uuid', nullable: true })
  requestedByUserId: string | null;

  @Column({ type: 'text', nullable: true })
  lastError: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  startedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  completedAt: Date | null;
}
