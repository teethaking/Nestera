import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

export enum ActivityTimelineCategory {
  SAVINGS = 'SAVINGS',
  GROUP = 'GROUP',
  GOAL = 'GOAL',
  TRANSFER = 'TRANSFER',
  REWARD = 'REWARD',
  DISPUTE = 'DISPUTE',
}

@Entity('activity_timelines')
@Index(['userId', 'createdAt'])
export class ActivityTimeline {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @Column({
    type: 'enum',
    enum: ActivityTimelineCategory,
  })
  category: ActivityTimelineCategory;

  @Column()
  action: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'uuid', nullable: true })
  referenceId: string;

  @Column('jsonb', { nullable: true })
  metadata: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;
}
