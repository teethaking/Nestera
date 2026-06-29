import { Injectable, Logger, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  Notification,
  NotificationType,
} from '../notifications/entities/notification.entity';
import { User } from '../user/entities/user.entity';
import {
  UserSubscription,
  SubscriptionStatus,
} from '../savings/entities/user-subscription.entity';
import { JobQueueService } from '../job-queue/job-queue.service';
import { ConfigService } from '@nestjs/config';
import { ShutdownTrackedTask } from '../../common/decorators/shutdown-task.decorator';
import { AdminNotificationRateLimiterService } from './admin-notification-rate-limiter.service';
import {
  BroadcastNotificationDto,
  ScheduleNotificationDto,
  PreviewNotificationDto,
  NotificationFilterDto,
  NotificationChannel,
  NotificationDeliveryDto,
} from './dto/admin-notification.dto';

@Injectable()
export class AdminNotificationsService {
  private readonly logger = new Logger(AdminNotificationsService.name);
  private readonly batchSize: number;

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserSubscription)
    private readonly subscriptionRepository: Repository<UserSubscription>,
    private readonly jobQueueService: JobQueueService,
    private readonly rateLimiter: AdminNotificationRateLimiterService,
    private readonly configService: ConfigService,
  ) {
    this.batchSize = this.configService.get<number>(
      'adminNotifications.batchSize',
      50,
    );
  }

  async broadcastNotification(
    dto: BroadcastNotificationDto,
  ): Promise<NotificationDeliveryDto> {
    const validation = this.rateLimiter.validateBroadcastConfig(
      dto.title,
      dto.message,
      dto.channels,
    );
    if (!validation.valid) {
      throw new BadRequestException(validation.error);
    }

    const targetUsers = await this.getTargetUsers(dto.target);
    const channels = dto.channels || [NotificationChannel.IN_APP];
    const targetKey = JSON.stringify(dto.target ?? { all: true });

    if (this.rateLimiter.isDuplicate(dto.title, dto.message, targetKey)) {
      throw new ConflictException(
        'Duplicate notification blocked within deduplication window',
      );
    }

    for (const channel of channels) {
      const rateCheck = this.rateLimiter.checkRateLimit(
        channel,
        targetUsers.length,
      );
      if (!rateCheck.allowed) {
        throw new BadRequestException(rateCheck.reason);
      }
    }

    const delivery: NotificationDeliveryDto = {
      sent: 0,
      delivered: 0,
      read: 0,
      failed: 0,
    };

    for (let i = 0; i < targetUsers.length; i += this.batchSize) {
      const batch = targetUsers.slice(i, i + this.batchSize);

      for (const user of batch) {
        delivery.sent++;

        try {
          for (const channel of channels) {
            if (channel === NotificationChannel.IN_APP) {
              await this.jobQueueService.addNotificationJob(
                {
                  userId: user.id,
                  type: NotificationType.ADMIN_BROADCAST,
                  title: dto.title,
                  message: dto.message,
                  metadata: { channels, broadcast: true, channel },
                },
                { delay: Math.floor(i / this.batchSize) * 1000 },
              );
            } else if (channel === NotificationChannel.EMAIL && user.email) {
              await this.jobQueueService.addEmailJob(
                {
                  to: user.email,
                  subject: dto.title,
                  template: 'raw',
                  context: { body: dto.message },
                },
                { delay: Math.floor(i / this.batchSize) * 1000 },
              );
            }
          }
          delivery.delivered++;
        } catch (error) {
          this.logger.error(
            `Failed to queue notification for user ${user.id}: ${(error as Error).message}`,
          );
          delivery.failed++;
        }
      }
    }

    this.logger.log(
      `Broadcast queued: ${delivery.sent} sent, ${delivery.delivered} queued, ${delivery.failed} failed`,
    );
    return delivery;
  }

  async scheduleNotification(
    dto: ScheduleNotificationDto,
  ): Promise<{ scheduleId: string }> {
    const validation = this.rateLimiter.validateScheduleConfig(
      dto.scheduledAt,
      dto.timezone,
    );
    if (!validation.valid) {
      throw new BadRequestException(validation.error);
    }

    const broadcastValidation = this.rateLimiter.validateBroadcastConfig(
      dto.title,
      dto.message,
      dto.channels,
    );
    if (!broadcastValidation.valid) {
      throw new BadRequestException(broadcastValidation.error);
    }

    const scheduledAt = new Date(dto.scheduledAt);
    const notification = this.notificationRepository.create({
      userId: 'SYSTEM',
      type: NotificationType.ADMIN_BROADCAST,
      title: dto.title,
      message: dto.message,
      metadata: {
        scheduled: true,
        processed: false,
        scheduledAt: scheduledAt.toISOString(),
        target: dto.target,
        channels: dto.channels || [NotificationChannel.IN_APP],
        timezone: dto.timezone,
      },
    });

    await this.notificationRepository.save(notification);
    this.logger.log(`Notification scheduled for ${scheduledAt.toISOString()}`);

    return { scheduleId: notification.id };
  }

  async cancelScheduledNotification(scheduleId: string): Promise<void> {
    const notification = await this.notificationRepository.findOne({
      where: { id: scheduleId },
    });

    if (!notification) {
      throw new BadRequestException(
        `Scheduled notification ${scheduleId} not found`,
      );
    }

    if (!notification.metadata?.scheduled) {
      throw new BadRequestException(
        `Notification ${scheduleId} is not a scheduled notification`,
      );
    }

    await this.notificationRepository.delete(scheduleId);
    this.logger.log(`Scheduled notification ${scheduleId} cancelled`);
  }

  async previewNotification(dto: PreviewNotificationDto): Promise<{
    previewUsers: { id: string; email: string; name: string }[];
    estimatedRecipients: number;
  }> {
    const targetUsers = await this.getTargetUsers(dto.target);
    const previewCount = dto.previewCount || 5;

    const previewUsers = targetUsers.slice(0, previewCount).map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
    }));

    return {
      previewUsers,
      estimatedRecipients: targetUsers.length,
    };
  }

  async getNotificationHistory(filter: NotificationFilterDto): Promise<{
    notifications: Notification[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = filter.page || 1;
    const limit = filter.limit || 20;
    const skip = (page - 1) * limit;

    const query = this.notificationRepository
      .createQueryBuilder('notification')
      .where('notification.type = :type', {
        type: NotificationType.ADMIN_BROADCAST,
      })
      .orderBy('notification.createdAt', 'DESC');

    if (filter.fromDate) {
      query.andWhere('notification.createdAt >= :fromDate', {
        fromDate: filter.fromDate,
      });
    }

    if (filter.toDate) {
      query.andWhere('notification.createdAt <= :toDate', {
        toDate: filter.toDate,
      });
    }

    if (filter.channel) {
      query.andWhere(
        "notification.metadata->'channels' @> :channel",
        { channel: JSON.stringify([filter.channel]) },
      );
    }

    const [notifications, total] = await query
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    return { notifications, total, page, limit };
  }

  async getDeliveryStats(
    notificationId: string,
  ): Promise<NotificationDeliveryDto> {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new BadRequestException(`Notification ${notificationId} not found`);
    }

    const related = await this.notificationRepository.find({
      where: {
        type: NotificationType.ADMIN_BROADCAST,
        title: notification.title,
      },
    });

    const delivered = related.filter((n) => !n.read).length;
    const read = related.filter((n) => n.read).length;

    return {
      sent: related.length,
      delivered,
      read,
      failed: 0,
    };
  }

  private async getTargetUsers(target?: {
    roles?: string[];
    kycStatus?: string[];
    tiers?: string[];
    minSavings?: number;
    maxSavings?: number;
    userIds?: string[];
  }): Promise<User[]> {
    const query = this.userRepository.createQueryBuilder('user');

    if (target?.userIds && target.userIds.length > 0) {
      query.andWhere('user.id IN (:...userIds)', { userIds: target.userIds });
    } else {
      query.where('user.isActive = :isActive', { isActive: true });

      if (target?.roles && target.roles.length > 0) {
        query.andWhere('user.role IN (:...roles)', { roles: target.roles });
      }

      if (target?.kycStatus && target.kycStatus.length > 0) {
        query.andWhere('user.kycStatus IN (:...kycStatus)', {
          kycStatus: target.kycStatus,
        });
      }

      if (target?.tiers && target.tiers.length > 0) {
        query.andWhere('user.tier IN (:...tiers)', { tiers: target.tiers });
      }
    }

    let users = await query.getMany();

    if (target?.minSavings !== undefined || target?.maxSavings !== undefined) {
      const userIdsWithSavings = await this.subscriptionRepository
        .createQueryBuilder('subscription')
        .select('subscription.userId', 'userId')
        .addSelect('SUM(subscription.amount)', 'total')
        .where('subscription.status = :status', {
          status: SubscriptionStatus.ACTIVE,
        })
        .groupBy('subscription.userId')
        .having(
          target.minSavings !== undefined && target.maxSavings !== undefined
            ? 'SUM(subscription.amount) BETWEEN :min AND :max'
            : target.minSavings !== undefined
              ? 'SUM(subscription.amount) >= :min'
              : 'SUM(subscription.amount) <= :max',
          {
            min: target.minSavings,
            max: target.maxSavings,
          },
        )
        .getRawMany();

      const validUserIds = new Set(userIdsWithSavings.map((u) => u.userId));
      users = users.filter((u) => validUserIds.has(u.id));
    }

    return users;
  }

  @ShutdownTrackedTask()
  @Cron(CronExpression.EVERY_MINUTE)
  async processScheduledNotifications(): Promise<void> {
    const now = new Date();

    const scheduledNotifications = await this.notificationRepository
      .createQueryBuilder('notification')
      .where('notification.metadata->>scheduled = :scheduled', {
        scheduled: 'true',
      })
      .andWhere('notification.metadata->>processed = :processed', {
        processed: 'false',
      })
      .andWhere('notification.metadata->>scheduledAt <= :now', {
        now: now.toISOString(),
      })
      .getMany();

    for (const notification of scheduledNotifications) {
      try {
        const dto: BroadcastNotificationDto = {
          title: notification.title,
          message: notification.message,
          channels: notification.metadata?.channels || [
            NotificationChannel.IN_APP,
          ],
          target: notification.metadata?.target,
        };

        await this.broadcastNotification(dto);

        notification.metadata = { ...notification.metadata, processed: true };
        await this.notificationRepository.save(notification);

        this.logger.log(`Processed scheduled notification ${notification.id}`);
      } catch (error) {
        this.logger.error(
          `Failed to process scheduled notification ${notification.id}: ${(error as Error).message}`,
        );
      }
    }
  }
}
