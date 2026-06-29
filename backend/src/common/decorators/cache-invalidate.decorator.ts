import { SetMetadata } from '@nestjs/common';

export const CACHE_INVALIDATE_KEY = 'cache_invalidate';

export interface CacheInvalidateOptions {
  key?: string;
  tag?: string;
  pattern?: string;
}

export const CacheInvalidate = (options: CacheInvalidateOptions) =>
  SetMetadata(CACHE_INVALIDATE_KEY, options);
