import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { randomUUID } from 'crypto';

export interface LockHandle {
  key: string;
  ownerId: string;
  acquiredAt: Date;
  release: () => Promise<void>;
  renew: () => Promise<boolean>;
}

export interface AcquireLockOptions {
  ttlMs?: number;
  retryMs?: number;
  maxRetries?: number;
}

interface InMemoryLock {
  ownerId: string;
  expiresAt: number;
}

const RELEASE_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("del", KEYS[1])
else
  return 0
end
`;

const RENEW_SCRIPT = `
if redis.call("get", KEYS[1]) == ARGV[1] then
  return redis.call("pexpire", KEYS[1], ARGV[2])
else
  return 0
end
`;

@Injectable()
export class DistributedLockService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DistributedLockService.name);
  private redis: Redis | null = null;
  private readonly inMemoryLocks = new Map<string, InMemoryLock>();
  private readonly instanceId = randomUUID();
  private readonly defaultTtlMs: number;
  private readonly renewalIntervalMs: number;
  private renewalTimer: NodeJS.Timeout | null = null;
  private readonly activeRenewals = new Map<string, NodeJS.Timeout>();

  constructor(private readonly configService: ConfigService) {
    this.defaultTtlMs = this.configService.get<number>(
      'distributedLock.defaultTtlMs',
      30_000,
    );
    this.renewalIntervalMs = this.configService.get<number>(
      'distributedLock.renewalIntervalMs',
      10_000,
    );
  }

  onModuleInit(): void {
    const redisUrl = this.configService.get<string>('redis.url');
    if (redisUrl) {
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 1,
        enableReadyCheck: true,
        lazyConnect: true,
      });
      this.redis.connect().catch((err) => {
        this.logger.warn(
          `Redis unavailable for distributed locks, using in-memory fallback: ${(err as Error).message}`,
        );
        this.redis = null;
      });
    } else {
      this.logger.warn(
        'REDIS_URL not configured; distributed locks use in-memory store (single-instance only)',
      );
    }

    this.renewalTimer = setInterval(() => {
      this.cleanupStaleInMemoryLocks();
    }, this.renewalIntervalMs);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.renewalTimer) {
      clearInterval(this.renewalTimer);
    }
    for (const timer of this.activeRenewals.values()) {
      clearInterval(timer);
    }
    this.activeRenewals.clear();
    if (this.redis) {
      await this.redis.quit();
    }
  }

  getInstanceId(): string {
    return this.instanceId;
  }

  async acquireLock(
    key: string,
    options: AcquireLockOptions = {},
  ): Promise<LockHandle | null> {
    const ttlMs = options.ttlMs ?? this.defaultTtlMs;
    const ownerId = `${this.instanceId}:${randomUUID()}`;
    const lockKey = this.normalizeKey(key);

    const acquired = this.redis
      ? await this.acquireRedisLock(lockKey, ownerId, ttlMs, options)
      : await this.acquireInMemoryLock(lockKey, ownerId, ttlMs, options);

    if (!acquired) {
      this.logger.debug(`Failed to acquire lock: ${lockKey}`);
      return null;
    }

    this.logger.debug(`Acquired lock ${lockKey} (owner=${ownerId})`);

    const handle: LockHandle = {
      key: lockKey,
      ownerId,
      acquiredAt: new Date(),
      release: async () => this.releaseLock(lockKey, ownerId),
      renew: async () => this.renewLock(lockKey, ownerId, ttlMs),
    };

    this.scheduleAutoRenewal(lockKey, ownerId, ttlMs);
    return handle;
  }

  async withLock<T>(
    key: string,
    fn: () => Promise<T>,
    options: AcquireLockOptions = {},
  ): Promise<T | null> {
    const handle = await this.acquireLock(key, options);
    if (!handle) {
      return null;
    }

    try {
      return await fn();
    } finally {
      await handle.release();
    }
  }

  async getLockInfo(
    key: string,
  ): Promise<{ ownerId: string; ttlMs: number } | null> {
    const lockKey = this.normalizeKey(key);

    if (this.redis) {
      const ownerId = await this.redis.get(lockKey);
      if (!ownerId) return null;
      const ttlMs = await this.redis.pttl(lockKey);
      return { ownerId, ttlMs: Math.max(ttlMs, 0) };
    }

    const entry = this.inMemoryLocks.get(lockKey);
    if (!entry || entry.expiresAt <= Date.now()) {
      return null;
    }
    return { ownerId: entry.ownerId, ttlMs: entry.expiresAt - Date.now() };
  }

  private normalizeKey(key: string): string {
    return key.startsWith('lock:') ? key : `lock:${key}`;
  }

  private async acquireRedisLock(
    lockKey: string,
    ownerId: string,
    ttlMs: number,
    options: AcquireLockOptions,
  ): Promise<boolean> {
    const maxRetries = options.maxRetries ?? 0;
    const retryMs = options.retryMs ?? 100;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const result = await this.redis!.set(lockKey, ownerId, 'PX', ttlMs, 'NX');
      if (result === 'OK') {
        return true;
      }
      if (attempt < maxRetries) {
        await this.sleep(retryMs);
      }
    }
    return false;
  }

  private async acquireInMemoryLock(
    lockKey: string,
    ownerId: string,
    ttlMs: number,
    options: AcquireLockOptions,
  ): Promise<boolean> {
    const maxRetries = options.maxRetries ?? 0;
    const retryMs = options.retryMs ?? 100;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      this.cleanupStaleInMemoryLocks();
      const existing = this.inMemoryLocks.get(lockKey);
      if (!existing || existing.expiresAt <= Date.now()) {
        this.inMemoryLocks.set(lockKey, {
          ownerId,
          expiresAt: Date.now() + ttlMs,
        });
        return true;
      }
      if (attempt < maxRetries) {
        await this.sleep(retryMs);
      }
    }
    return false;
  }

  private async releaseLock(lockKey: string, ownerId: string): Promise<void> {
    this.cancelAutoRenewal(lockKey);

    if (this.redis) {
      await this.redis.eval(RELEASE_SCRIPT, 1, lockKey, ownerId);
    } else {
      const existing = this.inMemoryLocks.get(lockKey);
      if (existing?.ownerId === ownerId) {
        this.inMemoryLocks.delete(lockKey);
      }
    }

    this.logger.debug(`Released lock ${lockKey}`);
  }

  private async renewLock(
    lockKey: string,
    ownerId: string,
    ttlMs: number,
  ): Promise<boolean> {
    if (this.redis) {
      const result = await this.redis.eval(
        RENEW_SCRIPT,
        1,
        lockKey,
        ownerId,
        ttlMs.toString(),
      );
      return result === 1;
    }

    const existing = this.inMemoryLocks.get(lockKey);
    if (existing?.ownerId === ownerId) {
      existing.expiresAt = Date.now() + ttlMs;
      return true;
    }
    return false;
  }

  private scheduleAutoRenewal(
    lockKey: string,
    ownerId: string,
    ttlMs: number,
  ): void {
    this.cancelAutoRenewal(lockKey);
    const intervalMs = Math.min(this.renewalIntervalMs, Math.floor(ttlMs / 3));

    const timer = setInterval(async () => {
      const renewed = await this.renewLock(lockKey, ownerId, ttlMs);
      if (!renewed) {
        this.cancelAutoRenewal(lockKey);
      }
    }, intervalMs);

    this.activeRenewals.set(lockKey, timer);
  }

  private cancelAutoRenewal(lockKey: string): void {
    const timer = this.activeRenewals.get(lockKey);
    if (timer) {
      clearInterval(timer);
      this.activeRenewals.delete(lockKey);
    }
  }

  private cleanupStaleInMemoryLocks(): void {
    const now = Date.now();
    for (const [key, entry] of this.inMemoryLocks.entries()) {
      if (entry.expiresAt <= now) {
        this.inMemoryLocks.delete(key);
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
