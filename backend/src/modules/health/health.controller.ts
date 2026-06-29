import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { HealthHistoryQueryDto } from './dto/health-history-query.dto';
import { HealthCollectorService } from './health-collector.service';
import { TypeOrmHealthIndicator } from './indicators/typeorm.health';
import { IndexerHealthIndicator } from './indicators/indexer.health';
import { RpcHealthIndicator } from './indicators/rpc.health';
import { ConnectionPoolHealthIndicator } from './indicators/connection-pool.health';
import {
  RedisHealthIndicator,
  EmailServiceHealthIndicator,
  SorobanRpcHealthIndicator,
  HorizonHealthIndicator,
} from './indicators/external-services.health';
import { StorageHealthIndicator } from './indicators/storage.health';
import { SystemHealthIndicator } from './indicators/system.health';
import {
  HealthHistoryService,
  HealthCheckResult,
} from './health-history.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly indexer: IndexerHealthIndicator,
    private readonly rpc: RpcHealthIndicator,
    private readonly connectionPool: ConnectionPoolHealthIndicator,
    private readonly redis: RedisHealthIndicator,
    private readonly email: EmailServiceHealthIndicator,
    private readonly sorobanRpc: SorobanRpcHealthIndicator,
    private readonly horizon: HorizonHealthIndicator,
    private readonly storage: StorageHealthIndicator,
    private readonly system: SystemHealthIndicator,
    private readonly healthHistory: HealthHistoryService,
    private readonly healthCollector: HealthCollectorService,
  ) {}

  @Get()
  @HealthCheck()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Full application health check',
    description:
      'Comprehensive health check including database, RPC endpoints, indexer service, and connection pool',
  })
  @ApiResponse({
    status: 200,
    description: 'Application is healthy',
    schema: {
      example: {
        status: 'ok',
        checks: {
          database: {
            status: 'up',
            responseTime: '45ms',
            threshold: '200ms',
          },
          database_pool: {
            status: 'up',
            metrics: {
              activeConnections: 5,
              idleConnections: 15,
              utilizationPercentage: 25,
            },
          },
          rpc: {
            status: 'up',
            responseTime: '120ms',
            currentEndpoint: 'https://soroban-testnet.stellar.org',
            totalEndpoints: 2,
          },
          indexer: {
            status: 'up',
            timeSinceLastProcess: '3500ms',
            threshold: '15000ms',
            lastProcessedTime: '2026-03-25T10:30:45.123Z',
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: 'One or more health checks failed',
    schema: {
      example: {
        status: 'error',
        checks: {
          database: {
            status: 'down',
            message: 'Database connection failed',
          },
        },
      },
    },
  })
  async check() {
    return this.health.check([
      () => this.db.isHealthy('database'),
      () => this.connectionPool.isHealthy(),
      () => this.rpc.isHealthy('rpc'),
      () => this.indexer.isHealthy('indexer'),
      () => this.redis.isHealthy('redis'),
      () => this.storage.isHealthy('storage'),
      () => this.email.isHealthy('email'),
      () => this.sorobanRpc.isHealthy('soroban-rpc'),
      () => this.horizon.isHealthy('horizon'),
    ]);
  }

  @Get('detailed')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Detailed health check for all external dependencies',
    description: 'Check status of all external services with response times',
  })
  async detailed() {
    const startTime = Date.now();
    const checks = await Promise.allSettled([
      this.db.isHealthy('database'),
      this.rpc.isHealthy('rpc'),
      this.indexer.isHealthy('indexer'),
      this.redis.isHealthy('redis'),
      this.email.isHealthy('email'),
      this.sorobanRpc.isHealthy('soroban-rpc'),
      this.horizon.isHealthy('horizon'),
      this.storage.isHealthy('storage'),
      this.system.isHealthy('system'),
    ]);

    const services = [
      'database',
      'rpc',
      'indexer',
      'redis',
      'email',
      'soroban-rpc',
      'horizon',
      'storage',
      'system',
    ];

    let healthyCount = 0;
    const results = checks.map((check, index) => {
      if (check.status === 'fulfilled') {
        healthyCount++;
        return check.value;
      }

      return {
        [services[index]]: {
          status: 'down',
          error: check.reason?.message || 'Unknown error',
        },
      };
    });

    const totalTime = Date.now() - startTime;
    const score = Math.round((healthyCount / services.length) * 100);
    const allHealthy = healthyCount === services.length;
    const timestamp = new Date();

    const historyEntries: HealthCheckResult[] = checks.map((check, index) => {
      const service = services[index];
      if (check.status === 'fulfilled') {
        const entry = check.value[service] as
          | Record<string, unknown>
          | undefined;
        const status = (entry?.status as string) ?? 'up';
        const normalizedStatus: HealthCheckResult['status'] =
          status === 'up' ? 'up' : status === 'degraded' ? 'degraded' : 'down';
        return {
          service,
          status: normalizedStatus,
          responseTime: parseInt(String(entry?.responseTime ?? '0'), 10) || 0,
          timestamp,
          error: entry?.message as string | undefined,
        };
      }
      return {
        service,
        status: 'down',
        responseTime: 0,
        timestamp,
        error: check.reason?.message || 'Unknown error',
      };
    });

    await this.healthHistory.recordChecks(historyEntries);

    return {
      status: allHealthy ? 'ok' : score > 70 ? 'degraded' : 'error',
      score: `${score}%`,
      timestamp: new Date().toISOString(),
      responseTime: `${totalTime}ms`,
      checks: Object.assign({}, ...results),
    };
  }

  @Get('dashboard')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Health check dashboard' })
  async dashboard(@Res() res: Response) {
    const data = await this.detailed();
    const scoreColor =
      parseInt(data.score) > 90
        ? '#10B981'
        : parseInt(data.score) > 70
          ? '#F59E0B'
          : '#EF4444';

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Nestera Health Dashboard</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #F3F4F6; margin: 0; padding: 20px; }
            .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
            h1 { margin-top: 0; color: #111827; }
            .score-card { display: flex; align-items: center; justify-content: space-between; margin-bottom: 30px; padding: 20px; background: #F9FAFB; border-radius: 8px; border-left: 5px solid ${scoreColor}; }
            .score-value { font-size: 48px; font-weight: bold; color: ${scoreColor}; }
            .service-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 15px; }
            .service-card { padding: 15px; border: 1px solid #E5E7EB; border-radius: 8px; }
            .service-name { font-weight: 600; text-transform: capitalize; margin-bottom: 5px; }
            .status-up { color: #10B981; }
            .status-down { color: #EF4444; }
            .metrics { font-size: 12px; color: #6B7280; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Nestera Health Dashboard</h1>
            <div class="score-card">
              <div>
                <div style="font-size: 14px; color: #6B7280;">Aggregate Health Score</div>
                <div class="score-value">${data.score}</div>
              </div>
              <div style="text-align: right;">
                <div style="font-weight: 600;">Status: ${data.status.toUpperCase()}</div>
                <div style="font-size: 12px; color: #6B7280;">Last check: ${new Date(data.timestamp).toLocaleString()}</div>
              </div>
            </div>
            <div class="service-grid">
              ${Object.entries(data.checks)
                .map(
                  ([name, details]: [string, any]) => `
                <div class="service-card">
                  <div class="service-name">${name.replace('-', ' ')}</div>
                  <div class="${details.status === 'up' ? 'status-up' : 'status-down'}">
                    ● ${details.status === 'up' ? 'Healthy' : 'Down'}
                  </div>
                  <div class="metrics">
                    ${details.responseTime ? `Response: ${details.responseTime}` : ''}
                    ${details.error ? `<div class="status-down">${details.error}</div>` : ''}
                  </div>
                </div>
              `,
                )
                .join('')}
            </div>
          </div>
          <script>
            setTimeout(() => window.location.reload(), 30000);
          </script>
        </body>
      </html>
    `;

    res.header('Content-Type', 'text/html');
    return res.send(html);
  }

  @Get('live')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Liveness probe',
    description: 'Simple endpoint for Kubernetes liveness probes',
  })
  live() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  @Get('ready')
  @HealthCheck()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Readiness probe',
    description:
      'Readiness check for Kubernetes - validates critical dependencies',
  })
  async ready() {
    return this.health.check([
      () => this.db.isHealthy('database'),
      () => this.connectionPool.isHealthy(),
      () => this.rpc.isHealthy('rpc'),
    ]);
  }

  @Get('history')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get health check history',
    description: 'Retrieve historical health check data',
  })
  async getHistory(@Query() query: HealthHistoryQueryDto) {
    const history = await this.healthHistory.getHistory({
      service: query.service,
      limit: query.limit,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });

    return { history, count: history.length };
  }

  @Get('stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get health statistics',
    description: 'Get uptime and performance statistics for all services',
  })
  async getStats() {
    return this.healthHistory.getAllStats();
  }

  @Get('admin/visualization')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Admin health history visualization data',
    description:
      'Returns time-series health data for admin dashboards (last N hours)',
  })
  async getAdminVisualization(@Query('hours') hours: number = 24) {
    return this.healthHistory.getVisualizationData(Number(hours) || 24);
  }
}
