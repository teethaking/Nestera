import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum WebhookDeliveryStatus {
  PENDING = 'PENDING',
  SUCCEEDED = 'SUCCEEDED',
  FAILED = 'FAILED',
}

export enum WebhookType {
  STELLAR = 'stellar',
}

@Entity('webhook_delivery_attempts')

@Index(['webhookType', 'status', 'nextRetryAt'])
@Index(['dedupeKey'], { unique: false })
export class WebhookDeliveryAttempt {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: WebhookType })
  webhookType!: WebhookType;

  @Column({ type: 'varchar', length: 128 })
  dedupeKey!: string;

  @Column({ type: 'int', default: 1 })
  attemptNumber!: number;

  @Column({ type: 'int', default: 5 })
  maxAttempts!: number;

  @Column({ type: 'enum', enum: WebhookDeliveryStatus, default: WebhookDeliveryStatus.PENDING })
  status!: WebhookDeliveryStatus;

  @Column({ type: 'timestamptz', nullable: true })
  nextRetryAt?: Date | null;

  @Column({ type: 'text', nullable: true })
  lastError?: string | null;

  @Column({ type: 'jsonb' })
  payload!: Record<string, any>;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}

