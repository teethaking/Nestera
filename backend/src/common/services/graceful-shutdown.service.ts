import {
  BeforeApplicationShutdown,
  Inject,
  Injectable,
  Logger,
  Optional,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { SchedulerRegistry } from '@nestjs/schedule';
import { Cache } from 'cache-manager';
import type { Server } from 'node:http';
import type { Socket } from 'node:net';
import { DataSource } from 'typeorm';

type ShutdownManagedServer = Server & {
  closeIdleConnections?: () => void;
  closeAllConnections?: () => void;
};

export type BackgroundWorker = {
  name: string;
  shutdown: () => Promise<void>;
};

@Injectable()
export class GracefulShutdownService implements BeforeApplicationShutdown {
  private static instance: GracefulShutdownService | null = null;

  private readonly logger = new Logger(GracefulShutdownService.name);
  private readonly activeSockets = new Set<Socket>();
  private readonly shutdownTimeoutMs = 30_000;
  private readonly backgroundWorkers: BackgroundWorker[] = [];

  private isShuttingDown = false;
  private schedulersStopped = false;
  private activeRequests = 0;
  private activeBackgroundTasks = 0;
  private registeredHttpServer?: ShutdownManagedServer;
  private closeServerPromise: Promise<void> | null = null;
  private shutdownPromise: Promise<number> | null = null;

  constructor(
    private readonly dataSource: DataSource,
    @Optional()
    @Inject(CACHE_MANAGER)
    private readonly cacheManager?: Cache,
    @Optional()
    private readonly schedulerRegistry?: SchedulerRegistry,
  ) {
    GracefulShutdownService.instance = this;
  }

  static async runTrackedTask<T>(
    taskName: string,
    task: () => Promise<T> | T,
  ): Promise<T | undefined> {
    if (!GracefulShutdownService.instance) {
      return Promise.resolve(task());
    }

    return GracefulShutdownService.instance.runBackgroundTask(taskName, task);
  }

  registerWorker(worker: BackgroundWorker): void {
    this.backgroundWorkers.push(worker);
    this.logger.log(`Registered background worker: ${worker.name}`);
  }

  registerHttpServer(server: Server): void {
    if (this.registeredHttpServer === server) {
      return;
    }

    this.registeredHttpServer = server;
    this.registeredHttpServer.on('connection', (socket: Socket) => {
      this.activeSockets.add(socket);
      socket.once('close', () => {
        this.activeSockets.delete(socket);
      });
    });
  }

  incrementActiveRequests(): void {
    if (this.isShuttingDown) {
      return;
    }

    this.activeRequests += 1;
  }

  decrementActiveRequests(): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
  }

  getActiveRequestCount(): number {
    return this.activeRequests;
  }

  getActiveBackgroundTaskCount(): number {
    return this.activeBackgroundTasks;
  }

  isShutdown(): boolean {
    return this.isShuttingDown;
  }

  beginShutdown(signal?: string): void {
    if (this.isShuttingDown) {
      return;
    }

    this.isShuttingDown = true;
    this.logger.warn(
      `Graceful shutdown initiated${signal ? ` by ${signal}` : ''}`,
    );
  }

  async onApplicationShutdown(signal?: string): Promise<void> {
    this.beginShutdown(signal);
    this.stopSchedulers();
    await this.waitForDrain(25_000);
    await this.stopBackgroundWorkers();
    await this.closeCacheConnections();
    await this.closeDatabaseConnections();
  }

  async beforeApplicationShutdown(signal?: string): Promise<void> {
    await this.onApplicationShutdown(signal);
  }

  async shutdownApplication(
    signal: NodeJS.Signals,
    closeApplication: () => Promise<void>,
    flushLogs?: () => Promise<void> | void,
  ): Promise<number> {
    if (this.shutdownPromise) {
      return this.shutdownPromise;
    }

    this.beginShutdown(signal);

    this.shutdownPromise = (async () => {
      try {
        await this.closeHttpServer();
        await this.beforeApplicationShutdown(signal);
        await closeApplication();
        await flushLogs?.();
        return 0;
      } catch (error) {
        const message =
          error instanceof Error
            ? (error.stack ?? error.message)
            : String(error);
        this.logger.error(`Graceful shutdown failed: ${message}`);
        await flushLogs?.();
        return 1;
      }
    })();

    return this.shutdownPromise;
  }

  private async runBackgroundTask<T>(
    taskName: string,
    task: () => Promise<T> | T,
  ): Promise<T | undefined> {
    if (this.isShuttingDown) {
      this.logger.warn(
        `Skipping background task "${taskName}" because shutdown is in progress`,
      );
      return undefined;
    }

    this.activeBackgroundTasks += 1;

    try {
      return await task();
    } finally {
      this.activeBackgroundTasks = Math.max(0, this.activeBackgroundTasks - 1);
    }
  }

  private stopSchedulers(): void {
    if (!this.schedulerRegistry || this.schedulersStopped) {
      return;
    }

    this.schedulersStopped = true;

    for (const [name, job] of this.schedulerRegistry.getCronJobs()) {
      job.stop();
      this.logger.log(`Stopped cron job "${name}"`);
    }

    for (const name of this.schedulerRegistry.getIntervals()) {
      clearInterval(this.schedulerRegistry.getInterval(name));
      this.schedulerRegistry.deleteInterval(name);
      this.logger.log(`Cleared interval "${name}"`);
    }

    for (const name of this.schedulerRegistry.getTimeouts()) {
      clearTimeout(this.schedulerRegistry.getTimeout(name));
      this.schedulerRegistry.deleteTimeout(name);
      this.logger.log(`Cleared timeout "${name}"`);
    }
  }

  private async waitForDrain(timeoutMs: number): Promise<void> {
    const startedAt = Date.now();

    while (this.activeRequests > 0 || this.activeBackgroundTasks > 0) {
      const elapsedMs = Date.now() - startedAt;
      if (elapsedMs >= timeoutMs) {
        this.logger.warn(
          `Shutdown drain timed out with ${this.activeRequests} active request(s) and ${this.activeBackgroundTasks} active background task(s) remaining.`,
        );
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  private async stopBackgroundWorkers(): Promise<void> {
    if (this.backgroundWorkers.length === 0) {
      return;
    }

    await Promise.allSettled(
      this.backgroundWorkers.map(async (worker) => {
        await worker.shutdown();
        this.logger.log(`Background worker stopped: ${worker.name}`);
      }),
    );
  }

  private async closeHttpServer(): Promise<void> {
    if (!this.registeredHttpServer) {
      return;
    }

    if (this.closeServerPromise) {
      return this.closeServerPromise;
    }

    const server = this.registeredHttpServer;

    this.closeServerPromise = new Promise<void>((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(forceCloseTimer);
        resolve();
      };

      const forceCloseTimer = setTimeout(() => {
        server.closeAllConnections?.();
        this.destroyOpenSockets();
        finish();
      }, this.shutdownTimeoutMs);

      try {
        server.close(() => finish());
        server.closeIdleConnections?.();
      } catch {
        finish();
      }
    });

    return this.closeServerPromise;
  }

  private async closeDatabaseConnections(): Promise<void> {
    if (!this.dataSource?.isInitialized) {
      return;
    }

    await this.dataSource.destroy();
  }

  private async closeCacheConnections(): Promise<void> {
    if (!this.cacheManager) {
      return;
    }

    const manager = this.cacheManager as Cache & {
      reset?: () => Promise<void>;
      store?: { client?: { quit?: () => Promise<void> } };
    };

    if (manager.reset) {
      await manager.reset();
      return;
    }

    await manager.store?.client?.quit?.();
  }

  private destroyOpenSockets(): void {
    for (const socket of this.activeSockets) {
      socket.destroy();
    }
    this.activeSockets.clear();
  }
}
