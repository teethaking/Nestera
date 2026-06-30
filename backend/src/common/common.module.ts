import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PiiEncryptionService } from './services/pii-encryption.service';
import { RateLimitMonitorService } from './services/rate-limit-monitor.service';
import { IdempotencyMonitorService } from './services/idempotency-monitor.service';
import { SecretsConfigService } from './services/secrets-config.service';
import { IdempotencyService } from './services/idempotency.service';
import { IdempotencyCleanupService } from './services/idempotency-cleanup.service';
import { LogSanitizerService } from './services/log-sanitizer.service';
import { CompressionMetricsService } from './services/compression-metrics.service';
import { CompressionMetricsMiddleware } from './middleware/compression.middleware';
import { AuditLogService } from './services/audit-log.service';
import { ContractCompatibilityService } from './services/contract-compatibility.service';
import { TenantContextService } from './services/tenant-context.service';
import { TenantContextMiddleware } from './middleware/tenant-context.middleware';
import { CacheModule } from '../modules/cache/cache.module';
import { AuditLog } from './entities/audit-log.entity';
import { Tenant } from './entities/tenant.entity';
import { DataScopeService } from './services/data-scope.service';
import { DistributedLockModule } from './distributed-lock/distributed-lock.module';

@Global()
@Module({
  imports: [CacheModule, TypeOrmModule.forFeature([AuditLog, Tenant])],
  providers: [
    RateLimitMonitorService,
    IdempotencyMonitorService,
    PiiEncryptionService,
    SecretsConfigService,
    IdempotencyService,
    IdempotencyCleanupService,
    LogSanitizerService,
    CompressionMetricsService,
    CompressionMetricsMiddleware,
    AuditLogService,
    ContractCompatibilityService,
    TenantContextService,
    TenantContextMiddleware,
    DataScopeService,
  ],
  exports: [
    RateLimitMonitorService,
    IdempotencyMonitorService,
    PiiEncryptionService,
    SecretsConfigService,
    IdempotencyService,
    LogSanitizerService,
    CompressionMetricsService,
    AuditLogService,
    ContractCompatibilityService,
    TenantContextService,
    DataScopeService,
    DistributedLockModule,
  ],
})
export class CommonModule {}
