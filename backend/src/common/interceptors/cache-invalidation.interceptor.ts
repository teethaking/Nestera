import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { CacheInvalidationService } from '../cache/cache-invalidation.service';
import {
  CACHE_INVALIDATE_KEY,
  CacheInvalidateOptions,
} from '../decorators/cache-invalidate.decorator';

@Injectable()
export class CacheInvalidationInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly cacheInvalidation: CacheInvalidationService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const options = this.reflector.get<CacheInvalidateOptions>(
      CACHE_INVALIDATE_KEY,
      context.getHandler(),
    );

    if (!options) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(async () => {
        if (options.key) {
          await this.cacheInvalidation.invalidateKey(options.key);
        }
        if (options.tag) {
          await this.cacheInvalidation.invalidateTag(options.tag);
        }
        if (options.pattern) {
          await this.cacheInvalidation.invalidatePattern(options.pattern);
        }
      }),
    );
  }
}
