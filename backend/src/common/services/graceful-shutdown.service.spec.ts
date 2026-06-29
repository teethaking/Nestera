import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { SchedulerRegistry } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { GracefulShutdownService } from './graceful-shutdown.service';

describe('GracefulShutdownService', () => {
  let service: GracefulShutdownService;
  let mockDataSource: {
    isInitialized: boolean;
    destroy: jest.Mock;
  };
  let mockCacheManager: {
    reset: jest.Mock;
  };
  let mockSchedulerRegistry: {
    getCronJobs: jest.Mock;
    getIntervals: jest.Mock;
    getInterval: jest.Mock;
    deleteInterval: jest.Mock;
    getTimeouts: jest.Mock;
    getTimeout: jest.Mock;
    deleteTimeout: jest.Mock;
  };

  beforeEach(async () => {
    mockDataSource = {
      isInitialized: true,
      destroy: jest.fn().mockResolvedValue(undefined),
    };

    mockCacheManager = {
      reset: jest.fn().mockResolvedValue(undefined),
    };

    mockSchedulerRegistry = {
      getCronJobs: jest.fn().mockReturnValue(new Map()),
      getIntervals: jest.fn().mockReturnValue([]),
      getInterval: jest.fn(),
      getTimeouts: jest.fn().mockReturnValue([]),
      getTimeout: jest.fn(),
      deleteInterval: jest.fn(),
      deleteTimeout: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GracefulShutdownService,
        { provide: DataSource, useValue: mockDataSource },
        { provide: CACHE_MANAGER, useValue: mockCacheManager },
        { provide: SchedulerRegistry, useValue: mockSchedulerRegistry },
      ],
    }).compile();

    service = module.get(GracefulShutdownService);
  });

  it('should track active requests', () => {
    expect(service.getActiveRequestCount()).toBe(0);
    service.incrementActiveRequests();
    service.incrementActiveRequests();
    expect(service.getActiveRequestCount()).toBe(2);
    service.decrementActiveRequests();
    expect(service.getActiveRequestCount()).toBe(1);
  });

  it('should not go below zero active requests', () => {
    service.decrementActiveRequests();
    expect(service.getActiveRequestCount()).toBe(0);
  });

  it('should not accept new requests during shutdown', async () => {
    expect(service.isShutdown()).toBe(false);
    await service.beforeApplicationShutdown('SIGTERM');
    expect(service.isShutdown()).toBe(true);
  });

  it('should close database on shutdown', async () => {
    await service.beforeApplicationShutdown('SIGTERM');
    expect(mockDataSource.destroy).toHaveBeenCalled();
  });

  it('should close Redis on shutdown', async () => {
    await service.beforeApplicationShutdown('SIGTERM');
    expect(mockCacheManager.reset).toHaveBeenCalled();
  });

  it('should stop scheduled jobs on shutdown', async () => {
    const mockCronJob = { stop: jest.fn() };
    mockSchedulerRegistry.getCronJobs.mockReturnValue(
      new Map([['test-cron', mockCronJob]]),
    );

    await service.beforeApplicationShutdown('SIGTERM');
    expect(mockCronJob.stop).toHaveBeenCalled();
  });

  it('should stop registered background workers on shutdown', async () => {
    const worker = {
      name: 'test-worker',
      shutdown: jest.fn().mockResolvedValue(undefined),
    };
    service.registerWorker(worker);

    await service.beforeApplicationShutdown('SIGTERM');
    expect(service.isShutdown()).toBe(true);
  });

  it('should handle worker shutdown failures gracefully', async () => {
    const worker = {
      name: 'failing-worker',
      shutdown: jest.fn().mockRejectedValue(new Error('shutdown failed')),
    };
    service.registerWorker(worker);

    await expect(service.beforeApplicationShutdown('SIGTERM')).resolves.not.toThrow();
  });

  it('should not increment requests when shutting down', async () => {
    await service.beforeApplicationShutdown('SIGTERM');
    service.incrementActiveRequests();
    expect(service.getActiveRequestCount()).toBe(0);
  });

  it('tracks background tasks while they are running', async () => {
    const trackedService = new GracefulShutdownService(
      mockDataSource as unknown as DataSource,
      mockCacheManager as unknown as any,
      mockSchedulerRegistry as unknown as SchedulerRegistry,
    );

    let releaseTask!: () => void;
    const runningTask = GracefulShutdownService.runTrackedTask(
      'spec.task',
      () =>
        new Promise<void>((resolve) => {
          releaseTask = resolve;
        }),
    );

    expect(trackedService.getActiveBackgroundTaskCount()).toBe(1);

    releaseTask();
    await runningTask;

    expect(trackedService.getActiveBackgroundTaskCount()).toBe(0);
  });

  it('skips new background tasks after shutdown starts', async () => {
    const trackedService = new GracefulShutdownService(
      mockDataSource as unknown as DataSource,
      mockCacheManager as unknown as any,
      mockSchedulerRegistry as unknown as SchedulerRegistry,
    );
    const task = jest.fn();

    trackedService.beginShutdown('SIGTERM');
    await GracefulShutdownService.runTrackedTask('spec.task', task);

    expect(task).not.toHaveBeenCalled();
  });

  it('stops schedulers and closes the database during shutdown', async () => {
    const cronStop = jest.fn();
    const schedulerRegistry = {
      getCronJobs: jest
        .fn()
        .mockReturnValue(new Map([['heartbeat', { stop: cronStop }]])),
      getIntervals: jest.fn().mockReturnValue(['metrics']),
      getInterval: jest
        .fn()
        .mockReturnValue(setInterval(() => undefined, 1_000)),
      deleteInterval: jest.fn(),
      getTimeouts: jest.fn().mockReturnValue(['reconnect']),
      getTimeout: jest.fn().mockReturnValue(setTimeout(() => undefined, 1_000)),
      deleteTimeout: jest.fn(),
    } as unknown as SchedulerRegistry;

    const trackedService = new GracefulShutdownService(
      mockDataSource as unknown as DataSource,
      undefined,
      schedulerRegistry,
    );

    await trackedService.beforeApplicationShutdown('SIGTERM');

    expect(cronStop).toHaveBeenCalled();
    expect(schedulerRegistry.deleteInterval).toHaveBeenCalledWith('metrics');
    expect(schedulerRegistry.deleteTimeout).toHaveBeenCalledWith('reconnect');
    expect(mockDataSource.destroy).toHaveBeenCalled();
  });
});
