import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  MilestoneNotification,
  MilestoneNotificationChannel,
} from '../entities/milestone-notification.entity';
import { SavingsGoalMilestone } from '../entities/savings-goal-milestone.entity';
import { SavingsGoal } from '../entities/savings-goal.entity';
import { User } from '../../user/entities/user.entity';
import { NotificationsService } from '../../notifications/notifications.service';
import { NotificationType } from '../../notifications/entities/notification.entity';

@Injectable()
export class MilestoneNotificationEngineService {
  private readonly logger = new Logger(MilestoneNotificationEngineService.name);

  constructor(
    @InjectRepository(MilestoneNotification)
    private readonly notificationRepo: Repository<MilestoneNotification>,
    @InjectRepository(SavingsGoalMilestone)
    private readonly milestoneRepo: Repository<SavingsGoalMilestone>,
    @InjectRepository(SavingsGoal)
    private readonly goalRepo: Repository<SavingsGoal>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly notificationsService: NotificationsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async notifyMilestoneAchieved(
    userId: string,
    goalId: string,
    milestoneId: string,
    percentage: number,
    label: string,
    bonusPoints: number,
  ): Promise<MilestoneNotification> {
    const goal = await this.goalRepo.findOne({ where: { id: goalId } });
    const goalName = goal?.goalName ?? 'Savings Goal';

    const title = `Milestone Reached: ${percentage}%`;
    const message = `${label} for "${goalName}"${bonusPoints > 0 ? ` — You earned ${bonusPoints} bonus points!` : ''}`;

    const notification = this.notificationRepo.create({
      userId,
      milestoneId,
      channel: MilestoneNotificationChannel.IN_APP,
      title,
      message,
      metadata: { goalId, percentage, bonusPoints, goalName },
    });

    await this.notificationsService.createNotification({
      userId,
      type: NotificationType.MILESTONE_ACHIEVED,
      title,
      message,
      metadata: { goalId, milestoneId, percentage, bonusPoints },
    });

    notification.delivered = true;
    notification.deliveredAt = new Date();
    const saved = (await this.notificationRepo.save(notification)) as MilestoneNotification;

    this.eventEmitter.emit('milestone.notification.sent', {
      userId,
      goalId,
      milestoneId,
      percentage,
      title,
      message,
    });

    return saved;
  }

  async notifyGoalCompleted(
    userId: string,
    goalId: string,
    goalName: string,
    targetAmount: number,
  ): Promise<MilestoneNotification> {
    const title = 'Goal Completed!';
    const message = `Amazing — you've reached your goal "${goalName}" (${targetAmount})!`;

    const notification = this.notificationRepo.create({
      userId,
      milestoneId: null as unknown as string,
      channel: MilestoneNotificationChannel.IN_APP,
      title,
      message,
      metadata: { goalId, goalName, targetAmount },
    });

    await this.notificationsService.createNotification({
      userId,
      type: NotificationType.GOAL_COMPLETED,
      title,
      message,
      metadata: { goalId, goalName, targetAmount },
    });

    notification.delivered = true;
    notification.deliveredAt = new Date();
    const saved = (await this.notificationRepo.save(notification)) as MilestoneNotification;

    this.eventEmitter.emit('goal.completed.notification.sent', {
      userId,
      goalId,
      goalName,
      targetAmount,
    });

    return saved;
  }

  async getNotificationsForUser(
    userId: string,
    limit: number = 20,
  ): Promise<MilestoneNotification[]> {
    return this.notificationRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepo.count({
      where: { userId, delivered: true },
    });
  }
}
