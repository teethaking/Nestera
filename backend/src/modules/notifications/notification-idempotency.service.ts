import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationIdempotency } from './entities/notification-idempotency.entity';

@Injectable()
export class NotificationIdempotencyService {
  private readonly logger = new Logger(NotificationIdempotencyService.name);

  constructor(
    @InjectRepository(NotificationIdempotency)
    private readonly idempotencyRepository: Repository<NotificationIdempotency>,
  ) {}

  /**
   * Check if a notification has already been dispatched for the given user+type+event
  Returns the existing record if found, null otherwise
   */
  async checkAndLock(
    userId: string,
    notificationType: string,
    eventId: string,
  ): Promise<NotificationIdempotency | null> {
    try {
      const existing = await this.idempotencyRepository.findOne({
        where: { userId, notificationType, eventId },
      });

      if (existing) {
        // If already dispatched, return it to prevent duplicate
        if (existing.dispatched) {
          this.logger.debug(
            `Notification already dispatched: ${notificationType} for user ${userId}, event ${eventId}`,
          );
          return existing;
        }

        // If not dispatched but exists (in progress), update retry count
        existing.retryCount += 1;
        existing.lastAttemptAt = new Date();
        await this.idempotencyRepository.save(existing);
        
        this.logger.debug(
          `Notification in progress (retry ${existing.retryCount}): ${notificationType} for user ${userId}, event ${eventId}`,
        );
        return existing;
      }

      // Create new idempotency record
      const newRecord = this.idempotencyRepository.create({
        userId,
        notificationType,
        eventId,
        dispatched: false,
        retryCount: 0,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      });

      await this.idempotencyRepository.save(newRecord);
      
      this.logger.debug(
        `Created idempotency record: ${notificationType} for user ${userId}, event ${eventId}`,
      );
      
      return null; // No existing record, safe to proceed
    } catch (error) {
      this.logger.error(
        `Error checking idempotency for ${notificationType} (user: ${userId}, event: ${eventId})`,
        error,
      );
      throw error;
    }
  }

  /**
   * Mark a notification as successfully dispatched
   */
  async markAsDispatched(
    userId: string,
    notificationType: string,
    eventId: string,
    notificationId?: string,
  ): Promise<void> {
    try {
      const record = await this.idempotencyRepository.findOne({
        where: { userId, notificationType, eventId },
      });

      if (record) {
        record.dispatched = true;
        record.dispatchedAt = new Date();
        if (notificationId) {
          record.notificationId = notificationId;
        }
        await this.idempotencyRepository.save(record);
        
        this.logger.debug(
          `Marked notification as dispatched: ${notificationType} for user ${userId}, event ${eventId}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Error marking notification as dispatched: ${notificationType} (user: ${userId}, event: ${eventId})`,
        error,
      );
      // Don't throw - marking as dispatched is best-effort
    }
  }

  /**
   * Clean up expired idempotency records
   */
  async cleanupExpiredRecords(): Promise<number> {
    try {
      const result = await this.idempotencyRepository
        .createQueryBuilder()
        .delete()
        .where('expiresAt < :now', { now: new Date() })
        .execute();

      const count = result.affected || 0;
      if (count > 0) {
        this.logger.log(`Cleaned up ${count} expired idempotency records`);
      }

      return count;
    } catch (error) {
      this.logger.error('Error cleaning up expired idempotency records', error);
      return 0;
    }
  }

  /**
   * Get statistics about idempotency records
   */
  async getStats(): Promise<{
    total: number;
    dispatched: number;
    pending: number;
    expired: number;
  }> {
    try {
      const total = await this.idempotencyRepository.count();
      const dispatched = await this.idempotencyRepository.count({
        where: { dispatched: true },
      });
      const pending = await this.idempotencyRepository.count({
        where: { dispatched: false },
      });
      const expired = await this.idempotencyRepository
        .createQueryBuilder()
        .where('expiresAt < :now', { now: new Date() })
        .getCount();

      return { total, dispatched, pending, expired };
    } catch (error) {
      this.logger.error('Error getting idempotency stats', error);
      return { total: 0, dispatched: 0, pending: 0, expired: 0 };
    }
  }
}
