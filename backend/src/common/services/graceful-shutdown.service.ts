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
  private readonly dataSource: DataSource;
  private readonly cacheManager?: Cache;
  private readonly schedulerRegistry?: SchedulerRegistry;

  private isShuttingDown = false;
  private schedulersStopped = false;
  private activeRequests = 0;
  private activeBackgroundTasks = 0;
  private registeredHttpServer?: ShutdownManagedServer;
  private closeServerPromise: Promise<void> | null = null;
  private shutdownPromise: Promise<number> | null = null;

  constructor(
    dataSource: DataSource,
    @Optional()
    @Inject(CACHE_MANAGER)
    cacheManager?: Cache,
    @Optional()
    schedulerRegistry?: SchedulerRegistry,
  ) {
    this.dataSource = dataSource;
    this.cacheManager = cacheManager;
    this.schedulerRegistry = schedulerRegistry;
    GracefulShutdownService.instance = this;
  }

  registerWorker(worker: BackgroundWorker): void {
    this.backgroundWorkers.push(worker);
    this.logger.log(`Registered background worker: ${worker.name}`);
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

  registerHttpServer(server: Server): void {
    if (this.registeredHttpServer === server) {
      return;
    }
    this.registeredHttpServer = server;
    this.registeredHttpServer.on('connection', (socket: Socket) => {
      this.activeSockets.add(socket);
      socket.once('close', () => this.activeSockets.delete(socket));
    });
  }

  incrementActiveRequests(): void {
    if (!this.isShuttingDown) {
      this.activeRequests += 1;
    }
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
        await closeApplication();
        await flushLogs?.();
        return 0;
      } catch (error) {
        const message =
          error instanceof Error ? (error.stack ?? error.message) : String(error);
        this.logger.error(`Graceful shutdown failed: ${message}`);
        await flushLogs?.();
        return 1;
      }
    })();
    return this.shutdownPromise;
  }

  async onApplicationShutdown(signal?: string): Promise<void> {
    this.beginShutdown(signal);
    this.stopSchedulers();
    this.registeredHttpServer?.closeIdleConnections?.();

    await this.waitForDrain(this.shutdownTimeoutMs - 5_000);
    await this.stopBackgroundWorkers();
    await this.closeCacheConnections();
    await this.closeDatabaseConnections();
  }

  async beforeApplicationShutdown(signal?: string): Promise<void> {
    this.beginShutdown(signal);
    this.stopSchedulers();
    this.registeredHttpServer?.closeIdleConnections?.();
    await this.waitForDrain(this.shutdownTimeoutMs - 5_000);
    await this.stopBackgroundWorkers();
    await this.closeCacheConnections();
    await this.closeDatabaseConnections();
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
        if (settled) return;
        settled = true;
        clearTimeout(forceCloseTimer);
        resolve();
      };
      const forceCloseTimer = setTimeout(() => {
        this.logger.warn(
          'HTTP server drain timeout reached. Closing remaining sockets.',
        );
        server.closeAllConnections?.();
        this.destroyOpenSockets();
        finish();
      }, this.shutdownTimeoutMs);

      try {
        server.close((error?: Error) => {
          if (
            error &&
            (error as NodeJS.ErrnoException).code !== 'ERR_SERVER_NOT_RUNNING'
          ) {
            this.logger.error(
              `Error while closing HTTP server: ${error.message}`,
            );
          }
          finish();
        });
        server.closeIdleConnections?.();
      } catch (error) {
        if (
          (error as NodeJS.ErrnoException).code !== 'ERR_SERVER_NOT_RUNNING'
        ) {
          const message =
            error instanceof Error ? error.message : String(error);
          this.logger.error(`Failed to stop HTTP server: ${message}`);
        }
        finish();
      }
    });
    return this.closeServerPromise;
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
    }
    for (const name of this.schedulerRegistry.getTimeouts()) {
      clearTimeout(this.schedulerRegistry.getTimeout(name));
      this.schedulerRegistry.deleteTimeout(name);
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
    if (this.backgroundWorkers.length === 0) return;
    this.logger.log(`Stopping ${this.backgroundWorkers.length} background worker(s)...`);
    const results = await Promise.allSettled(
      this.backgroundWorkers.map(async (worker) => {
        try {
          await worker.shutdown();
          this.logger.log(`Background worker stopped: ${worker.name}`);
        } catch (error) {
          this.logger.error(`Error stopping background worker ${worker.name}:`, error);
          throw error;
        }
      }),
    );
    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length > 0) {
      this.logger.warn(`${failed.length} background worker(s) failed to stop cleanly`);
    }
  }

  private async closeDatabaseConnections(): Promise<void> {
    if (!this.dataSource?.isInitialized) {
      return;
    }
    try {
      await this.dataSource.destroy();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error closing database connections: ${message}`);
    }
  }

  private async closeCacheConnections(): Promise<void> {
    if (!this.cacheManager) {
      return;
    }

    const manager = this.cacheManager as Cache & {
      reset?: () => Promise<void>;
      store?: {
        client?: {
          quit?: () => Promise<void>;
          disconnect?: () => Promise<void>;
        };
      };
      stores?: Array<{
        client?: {
          quit?: () => Promise<void>;
          disconnect?: () => Promise<void>;
        };
      }>;
    };

    try {
      if (manager.reset) {
        await manager.reset();
        return;
      }
      const store = manager.store ?? manager.stores?.[0];
      const client = store?.client;
      if (client?.quit) {
        await client.quit();
        return;
      }
      if (client?.disconnect) {
        await client.disconnect();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error closing cache connections: ${message}`);
    }
  }

  private destroyOpenSockets(): void {
    for (const socket of this.activeSockets) {
      socket.destroy();
    }
    this.activeSockets.clear();
  }
}
