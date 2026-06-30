import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ConflictException,
  Logger,
  Inject,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Request, Response } from 'express';
import { createHash } from 'crypto';
import {
  IDEMPOTENCY_KEY,
  IdempotencyOptions,
} from '../decorators/idempotent.decorator';
import { ErrorCode } from '../enums/error-code.enum';
import { EventEmitter2 } from '@nestjs/event-emitter';

interface StoredIdempotencyRecord {
  payloadHash: string;
  statusCode: number;
  body: unknown;
  completedAt: string;
}

const LOCK_SUFFIX = ':lock';
const LOCK_TTL_MS = 30_000;

/**
 * Infers a related entity type from the route path for admin observability.
 * e.g. /savings/123 → "savings", /transactions/abc → "transactions"
 */
function inferEntityType(path: string): string | undefined {
  const segments = path.split('/').filter(Boolean);
  // Return the first meaningful path segment (skipping 'api', 'v1', etc.)
  const skipSegments = new Set(['api', 'v1', 'v2', 'v3']);
  return segments.find((s) => !skipSegments.has(s) && !/^\d+$/.test(s));
}

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    @Optional() private readonly eventEmitter?: EventEmitter2,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const options = this.reflector.get<IdempotencyOptions | undefined>(
      IDEMPOTENCY_KEY,
      context.getHandler(),
    );

    if (!options) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const idempotencyKey = request.headers['idempotency-key'] as
      | string
      | undefined;

    if (!idempotencyKey) {
      return next.handle();
    }

    const cacheKey = `idempotency:${request.method}:${request.path}:${idempotencyKey}`;
    const payloadHash = this.hashPayload(request.body);

    const existing = await this.cache.get<StoredIdempotencyRecord>(cacheKey);

    if (existing) {
      if (existing.payloadHash !== payloadHash) {
        // Conflict: same key, different payload
        this.emitConflict({
          idempotencyKey,
          requestFingerprintHash: payloadHash,
          method: request.method,
          path: request.path,
          conflictType: 'payload_mismatch',
        });

        return throwError(
          () =>
            new ConflictException({
              errorCode: ErrorCode.IDEMPOTENCY_CONFLICT,
              message:
                'Idempotency key has already been used with a different request payload',
            }),
        );
      }

      this.logger.debug(
        `Idempotency cache hit for key=${idempotencyKey} on ${request.method} ${request.path}`,
      );

      // Emit replay event for monitoring
      this.eventEmitter?.emit('idempotency.replay', {
        key: idempotencyKey,
        method: request.method,
        path: request.path,
      });

      response.setHeader('Idempotency-Replay', 'true');
      response.status(existing.statusCode);
      return of(existing.body);
    }

    const lockKey = `${cacheKey}${LOCK_SUFFIX}`;
    const lockAcquired = await this.tryAcquireLock(lockKey);

    if (!lockAcquired) {
      // Conflict: concurrent processing with the same key
      this.emitConflict({
        idempotencyKey,
        requestFingerprintHash: payloadHash,
        method: request.method,
        path: request.path,
        conflictType: 'concurrent_processing',
      });

      return throwError(
        () =>
          new ConflictException({
            errorCode: ErrorCode.IDEMPOTENCY_CONFLICT,
            message:
              'A request with this idempotency key is currently being processed',
          }),
      );
    }

    const ttlMs = (options.ttlSeconds ?? 86400) * 1000;

    // Emit first_use event for monitoring
    this.eventEmitter?.emit('idempotency.first_use', {
      key: idempotencyKey,
      method: request.method,
      path: request.path,
    });

    return next.handle().pipe(
      tap(async (body) => {
        try {
          const record: StoredIdempotencyRecord = {
            payloadHash,
            statusCode: response.statusCode,
            body,
            completedAt: new Date().toISOString(),
          };
          await this.cache.set(cacheKey, record, ttlMs);
        } finally {
          await this.releaseLock(lockKey);
        }
      }),
      catchError(async (err) => {
        await this.releaseLock(lockKey);
        throw err;
      }),
    );
  }

  private hashPayload(body: unknown): string {
    const normalized = JSON.stringify(body ?? {});
    return createHash('sha256').update(normalized).digest('hex');
  }

  private async tryAcquireLock(lockKey: string): Promise<boolean> {
    const existing = await this.cache.get(lockKey);
    if (existing) return false;
    await this.cache.set(lockKey, '1', LOCK_TTL_MS);
    return true;
  }

  private async releaseLock(lockKey: string): Promise<void> {
    try {
      await this.cache.del(lockKey);
    } catch {
      // Lock cleanup is best-effort
    }
  }

  private emitConflict(params: {
    idempotencyKey: string;
    requestFingerprintHash: string;
    method: string;
    path: string;
    conflictType: 'payload_mismatch' | 'concurrent_processing';
  }): void {
    this.eventEmitter?.emit('idempotency.conflict', {
      idempotencyKey: params.idempotencyKey,
      requestFingerprintHash: params.requestFingerprintHash,
      method: params.method,
      path: params.path,
      conflictType: params.conflictType,
      timestamp: new Date().toISOString(),
      relatedEntityType: inferEntityType(params.path),
    });
  }
}
