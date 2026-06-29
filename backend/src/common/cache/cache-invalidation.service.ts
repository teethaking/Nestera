import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CacheStrategyService } from '../../modules/cache/cache-strategy.service';
import {
  CacheInvalidationEvent,
  CacheInvalidationByTagEvent,
  CacheInvalidationByPatternEvent,
} from './cache-invalidation.events';

@Injectable()
export class CacheInvalidationService {
  private readonly logger = new Logger(CacheInvalidationService.name);

  constructor(
    private readonly eventEmitter: EventEmitter2,
    @Optional()
    @Inject(CacheStrategyService)
    private readonly cacheStrategy?: CacheStrategyService,
  ) {
    this.setupEventListeners();
  }

  private setupEventListeners() {
    this.eventEmitter.on(
      CacheInvalidationEvent.name,
      async (event: CacheInvalidationEvent) => {
        await this.handleInvalidation(event);
      },
    );

    this.eventEmitter.on(
      CacheInvalidationByTagEvent.name,
      async (event: CacheInvalidationByTagEvent) => {
        await this.handleInvalidationByTag(event);
      },
    );

    this.eventEmitter.on(
      CacheInvalidationByPatternEvent.name,
      async (event: CacheInvalidationByPatternEvent) => {
        await this.handleInvalidationByPattern(event);
      },
    );
  }

  async invalidateKey(key: string) {
    this.eventEmitter.emit(
      CacheInvalidationEvent.name,
      new CacheInvalidationEvent(key),
    );
  }

  async invalidateTag(tag: string) {
    this.eventEmitter.emit(
      CacheInvalidationByTagEvent.name,
      new CacheInvalidationByTagEvent(tag),
    );
  }

  async invalidatePattern(pattern: string) {
    this.eventEmitter.emit(
      CacheInvalidationByPatternEvent.name,
      new CacheInvalidationByPatternEvent(pattern),
    );
  }

  private async handleInvalidation(event: CacheInvalidationEvent) {
    try {
      if (!this.cacheStrategy) {
        this.logger.warn('CacheStrategy not available, skipping invalidation');
        return;
      }
      await this.cacheStrategy.del(event.key);
      this.logger.debug(`Cache invalidated: ${event.key}`);
    } catch (error) {
      this.logger.error(`Failed to invalidate cache key ${event.key}:`, error);
    }
  }

  private async handleInvalidationByTag(event: CacheInvalidationByTagEvent) {
    try {
      if (!this.cacheStrategy) {
        this.logger.warn('CacheStrategy not available, skipping invalidation');
        return;
      }
      await this.cacheStrategy.invalidateByTag(event.tag);
      this.logger.debug(`Cache invalidated by tag: ${event.tag}`);
    } catch (error) {
      this.logger.error(
        `Failed to invalidate cache by tag ${event.tag}:`,
        error,
      );
    }
  }

  private async handleInvalidationByPattern(
    event: CacheInvalidationByPatternEvent,
  ) {
    try {
      if (!this.cacheStrategy) {
        this.logger.warn('CacheStrategy not available, skipping invalidation');
        return;
      }
      const keys = Array.from(
        (this.cacheStrategy as any).cacheManager.stores.keys(),
      );
      const keysToDelete = keys.filter((k: unknown) =>
        String(k).match(new RegExp(event.pattern)),
      );

      for (const key of keysToDelete) {
        await this.cacheStrategy.del(String(key));
      }

      this.logger.debug(
        `Cache invalidated by pattern ${event.pattern}: ${keysToDelete.length} keys`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to invalidate cache by pattern ${event.pattern}:`,
        error,
      );
    }
  }
}
