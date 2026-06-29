import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';

export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  retryAfterMs?: number;
}

@Injectable()
export class AdminNotificationRateLimiterService {
  private readonly logger = new Logger(AdminNotificationRateLimiterService.name);

  private readonly maxPerMinute: number;
  private readonly maxPerHour: number;
  private readonly dedupWindowMs: number;

  private minuteCounts = new Map<string, { count: number; resetAt: number }>();
  private hourCounts = new Map<string, { count: number; resetAt: number }>();
  private recentHashes = new Map<string, number>();

  constructor(private readonly configService: ConfigService) {
    this.maxPerMinute = this.configService.get<number>(
      'adminNotifications.maxPerMinute',
      60,
    );
    this.maxPerHour = this.configService.get<number>(
      'adminNotifications.maxPerHour',
      500,
    );
    this.dedupWindowMs = this.configService.get<number>(
      'adminNotifications.dedupWindowMs',
      300_000,
    );
  }

  checkRateLimit(channel: string, recipientCount: number): RateLimitResult {
    const now = Date.now();
    this.pruneExpired(now);

    const minuteKey = `${channel}:minute`;
    const hourKey = `${channel}:hour`;

    const minuteBucket = this.getOrCreateBucket(
      this.minuteCounts,
      minuteKey,
      now + 60_000,
    );
    const hourBucket = this.getOrCreateBucket(
      this.hourCounts,
      hourKey,
      now + 3_600_000,
    );

    if (minuteBucket.count + recipientCount > this.maxPerMinute) {
      return {
        allowed: false,
        reason: `Rate limit exceeded: max ${this.maxPerMinute} notifications per minute for ${channel}`,
        retryAfterMs: minuteBucket.resetAt - now,
      };
    }

    if (hourBucket.count + recipientCount > this.maxPerHour) {
      return {
        allowed: false,
        reason: `Rate limit exceeded: max ${this.maxPerHour} notifications per hour for ${channel}`,
        retryAfterMs: hourBucket.resetAt - now,
      };
    }

    minuteBucket.count += recipientCount;
    hourBucket.count += recipientCount;
    return { allowed: true };
  }

  isDuplicate(title: string, message: string, targetKey: string): boolean {
    const now = Date.now();
    this.pruneExpired(now);

    const hash = createHash('sha256')
      .update(`${title}:${message}:${targetKey}`)
      .digest('hex');

    const lastSent = this.recentHashes.get(hash);
    if (lastSent && now - lastSent < this.dedupWindowMs) {
      this.logger.debug(`Duplicate notification blocked (hash=${hash.slice(0, 8)})`);
      return true;
    }

    this.recentHashes.set(hash, now);
    return false;
  }

  validateScheduleConfig(scheduledAt: string, timezone?: string): {
    valid: boolean;
    error?: string;
  } {
    const scheduled = new Date(scheduledAt);
    if (isNaN(scheduled.getTime())) {
      return { valid: false, error: 'Invalid scheduledAt date' };
    }

    if (scheduled.getTime() <= Date.now()) {
      return { valid: false, error: 'scheduledAt must be in the future' };
    }

    const maxFutureMs = 90 * 24 * 60 * 60 * 1000;
    if (scheduled.getTime() - Date.now() > maxFutureMs) {
      return { valid: false, error: 'scheduledAt cannot be more than 90 days in the future' };
    }

    if (timezone) {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: timezone });
      } catch {
        return { valid: false, error: `Invalid timezone: ${timezone}` };
      }
    }

    return { valid: true };
  }

  validateBroadcastConfig(
    title: string,
    message: string,
    channels?: string[],
  ): { valid: boolean; error?: string } {
    if (!title?.trim()) {
      return { valid: false, error: 'Title is required' };
    }
    if (!message?.trim()) {
      return { valid: false, error: 'Message is required' };
    }
    if (title.length > 200) {
      return { valid: false, error: 'Title must be 200 characters or fewer' };
    }
    if (message.length > 5000) {
      return { valid: false, error: 'Message must be 5000 characters or fewer' };
    }
    if (channels && channels.length === 0) {
      return { valid: false, error: 'At least one channel is required' };
    }
    return { valid: true };
  }

  private getOrCreateBucket(
    map: Map<string, { count: number; resetAt: number }>,
    key: string,
    resetAt: number,
  ) {
    let bucket = map.get(key);
    if (!bucket || Date.now() >= bucket.resetAt) {
      bucket = { count: 0, resetAt };
      map.set(key, bucket);
    }
    return bucket;
  }

  private pruneExpired(now: number) {
    for (const [key, bucket] of this.minuteCounts) {
      if (now >= bucket.resetAt) this.minuteCounts.delete(key);
    }
    for (const [key, bucket] of this.hourCounts) {
      if (now >= bucket.resetAt) this.hourCounts.delete(key);
    }
    for (const [hash, sentAt] of this.recentHashes) {
      if (now - sentAt >= this.dedupWindowMs) this.recentHashes.delete(hash);
    }
  }
}
