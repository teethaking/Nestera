import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('reconciliation_records')
export class ReconciliationRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  recordType: string; // 'fee' or 'reward'

  @Column({ type: 'varchar', length: 100, nullable: true })
  referenceId: string; // e.g., transaction ID, reward profile ID

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  expectedAmount: number;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  actualAmount: number;

  @Column({ type: 'decimal', precision: 18, scale: 8 })
  discrepancy: number;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: string; // 'pending', 'corrected', 'discrepancy_reported', 'error'

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'boolean', default: false })
  autoCorrected: boolean;

  @Column({ type: 'timestamp', nullable: true })
  correctedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
