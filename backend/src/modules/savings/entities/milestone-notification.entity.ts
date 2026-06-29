import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { SavingsGoalMilestone } from './savings-goal-milestone.entity';
import { User } from '../../user/entities/user.entity';

export enum MilestoneNotificationChannel {
  IN_APP = 'IN_APP',
  EMAIL = 'EMAIL',
  PUSH = 'PUSH',
}

@Entity('milestone_notifications')
@Index(['userId', 'milestoneId'])
export class MilestoneNotification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @Column('uuid')
  milestoneId: string;

  @Column({
    type: 'enum',
    enum: MilestoneNotificationChannel,
    default: MilestoneNotificationChannel.IN_APP,
  })
  channel: MilestoneNotificationChannel;

  @Column()
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ default: false })
  delivered: boolean;

  @Column({ nullable: true })
  deliveredAt: Date;

  @Column('jsonb', { nullable: true })
  metadata: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @ManyToOne(() => SavingsGoalMilestone, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'milestoneId' })
  milestone: SavingsGoalMilestone;
}
