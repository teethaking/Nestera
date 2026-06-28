import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum ReconciliationStatus {
  PENDING = 'PENDING',
  RECONCILED = 'RECONCILED',
  DISCREPANCY = 'DISCREPANCY',
}

export enum ReconciliationType {
  FEE = 'FEE',
  REWARD = 'REWARD',
}

@Entity('fee_reconciliations')
@Index(['referenceType', 'referenceId'])
export class FeeReconciliation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: ReconciliationType,
  })
  referenceType: ReconciliationType;

  @Column('uuid')
  referenceId: string;

  @Column('uuid')
  userId: string;

  @Column('decimal', { precision: 18, scale: 6 })
  expectedAmount: number;

  @Column('decimal', { precision: 18, scale: 6 })
  actualAmount: number;

  @Column('decimal', { precision: 18, scale: 6 })
  difference: number;

  @Column('decimal', { precision: 6, scale: 3, nullable: true })
  discrepancyPercentage: number;

  @Column({
    type: 'enum',
    enum: ReconciliationStatus,
    default: ReconciliationStatus.PENDING,
  })
  status: ReconciliationStatus;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column('jsonb', { nullable: true })
  metadata: Record<string, unknown>;

  @Column({ nullable: true })
  reconciledAt: Date;

  @Column({ nullable: true })
  reconciledBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
