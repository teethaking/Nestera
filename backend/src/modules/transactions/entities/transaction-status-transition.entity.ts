import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Transaction, TxStatus } from './transaction.entity';

@Entity('transaction_status_transitions')
@Index(['transactionId', 'createdAt'])
export class TransactionStatusTransition {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column('uuid')
  transactionId!: string;

  @ManyToOne(() => Transaction, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'transactionId' })
  transaction!: Transaction;

  @Column({ type: 'enum', enum: TxStatus, nullable: true })
  fromStatus!: TxStatus | null;

  @Column({ type: 'enum', enum: TxStatus })
  toStatus!: TxStatus;

  @Column({ type: 'varchar', length: 128, default: 'system' })
  actor!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  reason!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata!: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt!: Date;
}
