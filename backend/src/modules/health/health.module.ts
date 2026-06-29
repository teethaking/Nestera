import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health.controller';
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
import { HealthHistoryService } from './health-history.service';
import { HealthCollectorService } from './health-collector.service';
import { HealthCheckRecord } from './entities/health-check-record.entity';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { ConnectionPoolModule } from '../../common/database/connection-pool.module';
import { DeadLetterEvent } from '../blockchain/entities/dead-letter-event.entity';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [
    TerminusModule,
    TypeOrmModule.forFeature([DeadLetterEvent, HealthCheckRecord]),
    BlockchainModule,
    ConnectionPoolModule,
    AuthModule,
  ],
  controllers: [HealthController],
  providers: [
    TypeOrmHealthIndicator,
    IndexerHealthIndicator,
    RpcHealthIndicator,
    ConnectionPoolHealthIndicator,
    RedisHealthIndicator,
    EmailServiceHealthIndicator,
    SorobanRpcHealthIndicator,
    HorizonHealthIndicator,
    StorageHealthIndicator,
    SystemHealthIndicator,
    HealthHistoryService,
    HealthCollectorService,
  ],
  exports: [HealthHistoryService, HealthCollectorService],
})
export class HealthModule {}
