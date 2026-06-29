import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum ReferralEventType {
  SIGNUP = 'signup',
  FIRST_DEPOSIT = 'first_deposit',
  REFERRAL_COMPLETED = 'referral_completed',
  REWARD_DISTRIBUTE = 'reward_distribute',
}

@Entity('processed_referral_events')
@Index(['eventType', 'userId'], { unique: true })
@Index(['eventType', 'referralId'], { unique: true, where: 'referralId IS NOT NULL' })
export class ProcessedReferralEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: ReferralEventType,
  })
  eventType: ReferralEventType;

  @Column('uuid', { nullable: true })
  userId: string | null;

  @Column('uuid', { nullable: true })
  referralId: string | null;

  @Column('uuid', { nullable: true })
  campaignId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn()
  createdAt: Date;
}
