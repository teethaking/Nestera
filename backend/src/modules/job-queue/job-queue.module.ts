import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from '../notifications/entities/notification.entity';
import { QUEUE_NAMES } from './job-queue.constants';
import { NotificationProcessor } from './processors/notification.processor';
import { EmailProcessor } from './processors/email.processor';
import { BlockchainProcessor } from './processors/blockchain.processor';
import { ReportProcessor } from './processors/report.processor';
import { JobQueueService } from './job-queue.service';
import { JobQueueController } from './job-queue.controller';

const defaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 2000 },
  removeOnComplete: { count: 500 },
  removeOnFail: { count: 1000 },
};

@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([Notification]),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('redis.url');
        const workerConcurrency = configService.get<number>(
          'eventStream.workerConcurrency',
          5,
        );
        if (redisUrl) {
          const url = new URL(redisUrl);
          return {
            connection: {
              host: url.hostname,
              port: parseInt(url.port, 10) || 6379,
              password: url.password || undefined,
            },
            workerOptions: { concurrency: workerConcurrency },
          };
        }
        return {
          connection: {
            host: 'localhost',
            port: 6379,
          },
          workerOptions: { concurrency: workerConcurrency },
        };
      },
    }),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.NOTIFICATIONS, defaultJobOptions },
      { name: QUEUE_NAMES.EMAIL, defaultJobOptions },
      {
        name: QUEUE_NAMES.BLOCKCHAIN,
        defaultJobOptions: {
          ...defaultJobOptions,
          attempts: 5,
          backoff: { type: 'exponential' as const, delay: 5000 },
        },
      },
      { name: QUEUE_NAMES.REPORTS, defaultJobOptions },
    ),
  ],
  controllers: [JobQueueController],
  providers: [
    JobQueueService,
    NotificationProcessor,
    EmailProcessor,
    BlockchainProcessor,
    ReportProcessor,
  ],
  exports: [JobQueueService, BullModule],
})
export class JobQueueModule {}
