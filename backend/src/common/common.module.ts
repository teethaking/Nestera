import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PiiEncryptionService } from './services/pii-encryption.service';
import { RateLimitMonitorService } from './services/rate-limit-monitor.service';
import { SecretsConfigService } from './services/secrets-config.service';
import { IdempotencyService } from './services/idempotency.service';
import { IdempotencyCleanupService } from './services/idempotency-cleanup.service';
import { LogSanitizerService } from './services/log-sanitizer.service';
import { CompressionMetricsService } from './services/compression-metrics.service';
import { CompressionMetricsMiddleware } from './middleware/compression.middleware';
import { AuditLogService } from './services/audit-log.service';
import { ContractCompatibilityService } from './services/contract-compatibility.service';
import { CacheModule } from '../modules/cache/cache.module';
import { AuditLog } from './entities/audit-log.entity';
import { DataScopeService } from './services/data-scope.service';
import { DistributedLockModule } from './distributed-lock/distributed-lock.module';

@Global()
@Module({
  imports: [CacheModule, TypeOrmModule.forFeature([AuditLog])],
  providers: [
    RateLimitMonitorService,
    PiiEncryptionService,
    SecretsConfigService,
    IdempotencyService,
    IdempotencyCleanupService,
    LogSanitizerService,
    CompressionMetricsService,
    CompressionMetricsMiddleware,
    AuditLogService,
    ContractCompatibilityService,
    DataScopeService,
  ],
  exports: [
    RateLimitMonitorService,
    PiiEncryptionService,
    SecretsConfigService,
    IdempotencyService,
    LogSanitizerService,
    CompressionMetricsService,
    AuditLogService,
    ContractCompatibilityService,
    DataScopeService,
    DistributedLockModule,
  ],
})
export class CommonModule {}
