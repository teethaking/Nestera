import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Transaction } from './transaction.entity';

@Entity('transaction_receipts')
export class Receipt extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user?: User;

  @Index('idx_receipts_user_id')
  @Column('uuid')
  userId: string;

  @ManyToOne(() => Transaction, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'transactionId' })
  transaction?: Transaction;

  @Index('idx_receipts_transaction_id')
  @Column('uuid')
  transactionId: string;

  @Column('bytea')
  pdfData: Buffer;

  @Column('varchar')
  verificationReference: string;

  @Column('varchar', { nullable: true })
  accessKey: string | null;

  @Column({ type: 'boolean', default: false })
  isPublic: boolean;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastAccessedAt: Date | null;

  @Column({ type: 'int', default: 0 })
  accessCount: number;
}
