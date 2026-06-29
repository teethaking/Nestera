import { ConfigService } from '@nestjs/config';
import { DistributedLockService } from './distributed-lock.service';

describe('DistributedLockService', () => {
  let service: DistributedLockService;

  beforeEach(async () => {
    service = new DistributedLockService({
      get: jest.fn((key: string, defaultValue?: unknown) => {
        const map: Record<string, unknown> = {
          'distributedLock.defaultTtlMs': 5_000,
          'distributedLock.renewalIntervalMs': 1_000,
          'redis.url': undefined,
        };
        return map[key] ?? defaultValue;
      }),
    } as unknown as ConfigService);

    service.onModuleInit();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  it('acquires and releases in-memory lock exclusively', async () => {
    const first = await service.acquireLock('indexer:stream:test');
    expect(first).not.toBeNull();

    const second = await service.acquireLock('indexer:stream:test');
    expect(second).toBeNull();

    await first!.release();

    const third = await service.acquireLock('indexer:stream:test');
    expect(third).not.toBeNull();
    await third!.release();
  });

  it('prevents duplicate processing via withLock', async () => {
    let runs = 0;
    let releaseFirst!: () => void;
    const gate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const firstPromise = service.withLock('replay:job:1', async () => {
      runs++;
      await gate;
      return 'ok';
    });

    await new Promise((resolve) => setTimeout(resolve, 10));

    const second = await service.withLock('replay:job:1', async () => {
      runs++;
      return 'blocked';
    });

    releaseFirst();
    const first = await firstPromise;

    expect(first).toBe('ok');
    expect(second).toBeNull();
    expect(runs).toBe(1);
  });

  it('renews owned lock lease', async () => {
    const handle = await service.acquireLock('indexer:stream:renew', {
      ttlMs: 10_000,
    });
    expect(handle).not.toBeNull();

    const renewed = await handle!.renew();
    expect(renewed).toBe(true);

    await handle!.release();
  });

  it('tracks lock ownership metadata', async () => {
    const handle = await service.acquireLock('indexer:stream:info');
    expect(handle).not.toBeNull();

    const info = await service.getLockInfo('indexer:stream:info');
    expect(info?.ownerId).toBe(handle!.ownerId);

    await handle!.release();
    expect(await service.getLockInfo('indexer:stream:info')).toBeNull();
  });
});
