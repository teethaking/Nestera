import {
  BaseEntity,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity('notification_idempotency')
@Unique(['userId', 'notificationType', 'eventId'])
export class NotificationIdempotency extends BaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('idx_notif_idempotency_user_id')
  @Column('uuid')
  userId: string;

  @Index('idx_notif_idempotency_type')
  @Column('varchar')
  notificationType: string;

  @Index('idx_notif_idempotency_event_id')
  @Column('varchar')
  eventId: string;

  @Column('varchar', { nullable: true })
  notificationId: string | null;

  @Column({ type: 'boolean', default: false })
  dispatched: boolean;

  @Column({ type: 'timestamp', nullable: true })
  dispatchedAt: Date | null;

  @Column({ type: 'int', default: 0 })
  retryCount: number;

  @Column({ type: 'timestamp', nullable: true })
  lastAttemptAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
