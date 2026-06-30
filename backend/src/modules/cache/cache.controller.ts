import {
  Controller,
  Get,
  Post,
  Delete,
  UseGuards,
  Param,
  Body,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
} from '@nestjs/swagger';
import { CacheStrategyService } from './cache-strategy.service';
import { CacheWarmingService } from './cache-warming.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ApiProperty } from '@nestjs/swagger';

class CacheMetricsResponseDto {
  @ApiProperty({ example: 124 })
  hits: number;

  @ApiProperty({ example: 31 })
  misses: number;

  @ApiProperty({ example: 12 })
  sets: number;

  @ApiProperty({ example: 8 })
  deletes: number;

  @ApiProperty({ example: 8, description: 'Total eviction-style deletes observed' })
  evictions: number;

  @ApiProperty({ example: 0.8, description: 'Hit ratio as a decimal' })
  hitRatio: number;

  @ApiProperty({ example: 0.2, description: 'Miss ratio as a decimal' })
  missRatio: number;

  @ApiProperty({ example: '80.00%' })
  hitRate: string;

  @ApiProperty({ example: '20.00%' })
  missRate: string;
}

@ApiTags('Cache')
@Controller('cache')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CacheController {
  constructor(
    private readonly cacheStrategy: CacheStrategyService,
    private readonly cacheWarming: CacheWarmingService,
  ) {}

  @Get('metrics')
  @ApiOperation({
    summary: 'Get cache hit/miss ratios and per-operation latency (avg/p95/p99)',
  })
  @ApiOkResponse({ type: CacheMetricsResponseDto })
  getMetrics() {
    return this.cacheStrategy.getMetrics();
  }

  @Get('dashboard')
  @ApiOperation({
    summary: 'Get cache dashboard summary including hit ratio, misses, and evictions',
  })
  @ApiOkResponse({ type: CacheMetricsResponseDto })
  getDashboard() {
    return this.cacheStrategy.getMetrics();
  }

  @Delete('metrics')
  @ApiOperation({ summary: 'Reset cache metrics counters and latency buckets' })
  resetMetrics() {
    this.cacheStrategy.resetMetrics();
    return { message: 'Cache metrics reset' };
  }

  @Get('warming-metrics')
  @ApiOperation({ summary: 'Get cache warming metrics' })
  getWarmingMetrics() {
    return this.cacheWarming.getWarmingMetrics();
  }

  @Get('registered-endpoints')
  @ApiOperation({ summary: 'Get registered cacheable endpoints' })
  getRegisteredEndpoints() {
    return this.cacheWarming.getRegisteredEndpoints();
  }

  @Post('warm-all')
  @ApiOperation({ summary: 'Warm all cacheable endpoints manually' })
  async warmAllEndpoints() {
    await this.cacheWarming.warmAllEndpoints();
    return { message: 'Cache warming initiated' };
  }

  @Delete('invalidate/tag/:tag')
  @ApiOperation({
    summary: 'Invalidate all cache entries tagged with the given tag',
    description:
      'Merges both the in-process tag index and the Redis-backed tag set ' +
      'before deleting, so it is safe across restarts and multiple instances.',
  })
  async invalidateByTag(@Param('tag') tag: string) {
    await this.cacheStrategy.invalidateByTag(tag);
    return { message: `Invalidated all keys with tag: ${tag}` };
  }

  @Delete('invalidate/pattern/:pattern')
  @ApiOperation({
    summary:
      'Invalidate all tagged cache entries whose key contains the given pattern',
  })
  async invalidateByPattern(@Param('pattern') pattern: string) {
    await this.cacheStrategy.invalidateByPattern(pattern);
    return { message: `Invalidated all keys matching pattern: ${pattern}` };
  }

  @Post('invalidate/keys')
  @ApiOperation({
    summary: 'Invalidate a specific set of cache keys (write-side invalidation)',
    description:
      'Use this from service write paths to invalidate exactly the keys that ' +
      'were affected by a mutation, without needing a tag.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        keys: { type: 'array', items: { type: 'string' } },
      },
      required: ['keys'],
    },
  })
  async invalidateKeys(@Body('keys') keys: string[]) {
    if (!Array.isArray(keys) || keys.length === 0) {
      return { message: 'No keys provided', invalidated: 0 };
    }
    await this.cacheStrategy.invalidateKeys(keys);
    return { message: `Invalidated ${keys.length} key(s)`, invalidated: keys.length };
  }
}
