import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum AdminExportDataType {
  TRANSACTIONS = 'transactions',
  DISPUTES = 'disputes',
}

export enum AdminExportStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

@Entity('admin_export_jobs')
@Index(['userId', 'status'])
@Index(['createdAt'])
export class AdminExportJob {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64 })
  userId!: string;

  @Column({ type: 'varchar', length: 32 })
  dataType!: AdminExportDataType;

  @Column({ type: 'varchar', length: 32, default: 'csv' })
  format!: string;

  @Column({
    type: 'varchar',
    length: 32,
    default: AdminExportStatus.PENDING,
  })
  status!: AdminExportStatus;

  @Column({ type: 'varchar', length: 128, nullable: true })
  queueJobId?: string | null;

  @Column({ type: 'text', nullable: true })
  filePath?: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  fileName?: string | null;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string | null;

  @Column({ type: 'timestamp', nullable: true })
  completedAt?: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt?: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  requestPayload?: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  requestedByRole?: string | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
