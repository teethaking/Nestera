import { SchedulerRegistry } from '@nestjs/schedule';
import { GracefulShutdownService } from './graceful-shutdown.service';

describe('GracefulShutdownService', () => {
  const createService = () => {
    jest.useFakeTimers();

    const dataSource = {
      isInitialized: true,
      destroy: jest.fn().mockResolvedValue(undefined),
    } as const;

    const schedulerRegistry = {
      getCronJobs: jest.fn().mockReturnValue(
        new Map([
          ['heartbeat', { stop: jest.fn() }],
        ]),
      ),
      getIntervals: jest.fn().mockReturnValue(['metrics']),
      getInterval: jest.fn().mockReturnValue(setInterval(() => undefined, 1_000)),
      deleteInterval: jest.fn(),
      getTimeouts: jest.fn().mockReturnValue(['reconnect']),
      getTimeout: jest.fn().mockReturnValue(setTimeout(() => undefined, 1_000)),
      deleteTimeout: jest.fn(),
    } as unknown as SchedulerRegistry;

    const service = new GracefulShutdownService(
      dataSource as never,
      undefined,
      schedulerRegistry,
    );

    return { dataSource, schedulerRegistry, service };
  };

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('tracks background tasks while they are running', async () => {
    const { service } = createService();

    let releaseTask!: () => void;
    const runningTask = GracefulShutdownService.runTrackedTask(
      'spec.task',
      () =>
        new Promise<void>((resolve) => {
          releaseTask = resolve;
        }),
    );

    expect(service.getActiveBackgroundTaskCount()).toBe(1);

    releaseTask();
    await runningTask;

    expect(service.getActiveBackgroundTaskCount()).toBe(0);
  });

  it('skips new background tasks after shutdown starts', async () => {
    const { service } = createService();
    const task = jest.fn();

    service.beginShutdown('SIGTERM');
    await GracefulShutdownService.runTrackedTask('spec.task', task);

    expect(task).not.toHaveBeenCalled();
  });

  it('stops schedulers and closes the database during shutdown', async () => {
    const { dataSource, schedulerRegistry, service } = createService();

    await service.beforeApplicationShutdown('SIGTERM');

    const cronJobs = schedulerRegistry.getCronJobs() as Map<
      string,
      { stop: jest.Mock }
    >;
    const heartbeatJob = cronJobs.get('heartbeat');

    expect(heartbeatJob?.stop).toHaveBeenCalled();
    expect(schedulerRegistry.deleteInterval).toHaveBeenCalledWith('metrics');
    expect(schedulerRegistry.deleteTimeout).toHaveBeenCalledWith('reconnect');
    expect(dataSource.destroy).toHaveBeenCalled();
  });
});
