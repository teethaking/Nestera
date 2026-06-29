import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { SavingsGroup } from './savings-group.entity';

export enum InvitationStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

@Entity('group_invitations')
export class GroupInvitation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  groupId: string;

  @Column('uuid')
  inviterId: string;

  @Column('uuid')
  inviteeId: string;

  @Column({
    type: 'enum',
    enum: InvitationStatus,
    default: InvitationStatus.PENDING,
  })
  status: InvitationStatus;

  @Column({ type: 'text', nullable: true })
  message: string | null;

  @Column({ nullable: true })
  respondedAt: Date;

  @Column({ nullable: true })
  expiresAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => SavingsGroup, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'groupId' })
  group: SavingsGroup;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'inviterId' })
  inviter: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'inviteeId' })
  invitee: User;
}
