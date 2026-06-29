import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  BlockchainReplayJob,
  ReplayJobMode,
  ReplayJobStatus,
} from './entities/blockchain-replay-job.entity';
import { IndexerService } from './indexer.service';
import { DistributedLockService } from '../../common/distributed-lock/distributed-lock.service';
import { AuditLogService } from '../../common/services/audit-log.service';
import {
  AuditAction,
  AuditResourceType,
} from '../../common/entities/audit-log.entity';
import { CreateReplayJobDto } from './dto/replay.dto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class BlockchainReplayService {
  private readonly logger = new Logger(BlockchainReplayService.name);
  private readonly lockTtlMs: number;

  constructor(
    @InjectRepository(BlockchainReplayJob)
    private readonly replayJobRepo: Repository<BlockchainReplayJob>,
    private readonly indexerService: IndexerService,
    private readonly lockService: DistributedLockService,
    private readonly auditLogService: AuditLogService,
    private readonly configService: ConfigService,
  ) {
    this.lockTtlMs = this.configService.get<number>(
      'distributedLock.replayTtlMs',
      120_000,
    );
  }

  async createReplayJob(
    dto: CreateReplayJobDto,
    adminUserId: string,
  ): Promise<BlockchainReplayJob> {
    this.validateReplayRequest(dto);

    const activeJob = await this.replayJobRepo.findOne({
      where: [
        { status: ReplayJobStatus.PENDING },
        { status: ReplayJobStatus.RUNNING },
      ],
      order: { createdAt: 'DESC' },
    });

    if (activeJob) {
      throw new ConflictException(
        `Replay job ${activeJob.id} is already ${activeJob.status}`,
      );
    }

    const job = await this.replayJobRepo.save(
      this.replayJobRepo.create({
        mode: dto.mode,
        status: ReplayJobStatus.PENDING,
        startLedger:
          dto.mode === ReplayJobMode.LEDGER_RANGE ? dto.startLedger! : null,
        endLedger:
          dto.mode === ReplayJobMode.LEDGER_RANGE
            ? dto.endLedger!
            : (dto.endLedgerForCursor ?? null),
        eventCursor:
          dto.mode === ReplayJobMode.EVENT_CURSOR ? dto.eventCursor! : null,
        requestedByUserId: adminUserId,
        metadata: {
          requestedMode: dto.mode,
        },
      }),
    );

    await this.auditLogService.log({
      action: AuditAction.CREATE,
      resourceType: AuditResourceType.SYSTEM,
      resourceId: job.id,
      actor: adminUserId,
      description: `Blockchain replay job created (${dto.mode})`,
      newValue: {
        mode: dto.mode,
        startLedger: dto.startLedger,
        endLedger: dto.endLedger ?? dto.endLedgerForCursor,
        eventCursor: dto.eventCursor,
      },
    });

    void this.executeReplayJob(job.id);
    return job;
  }

  async getReplayJob(jobId: string): Promise<BlockchainReplayJob> {
    const job = await this.replayJobRepo.findOne({ where: { id: jobId } });
    if (!job) {
      throw new NotFoundException(`Replay job ${jobId} not found`);
    }
    return job;
  }

  toProgress(job: BlockchainReplayJob) {
    const total = job.totalEvents || 0;
    const done = job.eventsProcessed + job.eventsFailed + job.eventsSkipped;
    const progressPercent =
      total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;

    return {
      id: job.id,
      mode: job.mode,
      status: job.status,
      eventsProcessed: job.eventsProcessed,
      eventsFailed: job.eventsFailed,
      eventsSkipped: job.eventsSkipped,
      totalEvents: job.totalEvents,
      lastError: job.lastError,
      progressPercent,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
    };
  }

  private validateReplayRequest(dto: CreateReplayJobDto): void {
    if (dto.mode === ReplayJobMode.LEDGER_RANGE) {
      if (dto.startLedger === undefined || dto.endLedger === undefined) {
        throw new BadRequestException(
          'startLedger and endLedger are required for ledger_range replay',
        );
      }
      if (dto.startLedger > dto.endLedger) {
        throw new BadRequestException('startLedger must be <= endLedger');
      }
      const maxRange = this.configService.get<number>(
        'blockchainReplay.maxLedgerRange',
        10_000,
      );
      if (dto.endLedger - dto.startLedger > maxRange) {
        throw new BadRequestException(
          `Ledger range exceeds maximum of ${maxRange}`,
        );
      }
      return;
    }

    if (!dto.eventCursor) {
      throw new BadRequestException(
        'eventCursor is required for event_cursor replay',
      );
    }
  }

  private async executeReplayJob(jobId: string): Promise<void> {
    const lock = await this.lockService.acquireLock(`replay:job:${jobId}`, {
      ttlMs: this.lockTtlMs,
      maxRetries: 3,
      retryMs: 500,
    });

    if (!lock) {
      await this.markJobFailed(jobId, 'Unable to acquire replay lock');
      return;
    }

    let job = await this.getReplayJob(jobId);
    job.status = ReplayJobStatus.RUNNING;
    job.startedAt = new Date();
    job.lockOwnerId = lock.ownerId;
    job = await this.replayJobRepo.save(job);

    try {
      await this.indexerService.reloadContractIds();

      const events =
        job.mode === ReplayJobMode.LEDGER_RANGE
          ? await this.indexerService.fetchEventsFromRange(
              Number(job.startLedger),
              Number(job.endLedger),
            )
          : await this.indexerService.fetchEventsFromRange(
              Number(job.startLedger ?? 0),
              job.endLedger ? Number(job.endLedger) : undefined,
              job.eventCursor,
            );

      job.totalEvents = events.length;
      await this.replayJobRepo.save(job);

      const result = await this.indexerService.processEventsForReplay(events);
      await this.indexerService.refreshState();

      job.eventsProcessed = result.processed;
      job.eventsFailed = result.failed;
      job.eventsSkipped = result.skipped;
      job.status = ReplayJobStatus.COMPLETED;
      job.completedAt = new Date();
      await this.replayJobRepo.save(job);

      await this.auditLogService.log({
        action: AuditAction.UPDATE,
        resourceType: AuditResourceType.SYSTEM,
        resourceId: job.id,
        actor: job.requestedByUserId ?? 'system',
        description: 'Blockchain replay job completed',
        newValue: result,
        success: true,
      });
    } catch (error) {
      const message = (error as Error).message;
      this.logger.error(`Replay job ${jobId} failed: ${message}`);
      await this.markJobFailed(jobId, message);
    } finally {
      await lock.release();
    }
  }

  private async markJobFailed(jobId: string, message: string): Promise<void> {
    const job = await this.replayJobRepo.findOne({ where: { id: jobId } });
    if (!job) {
      return;
    }

    job.status = ReplayJobStatus.FAILED;
    job.lastError = message;
    job.completedAt = new Date();
    await this.replayJobRepo.save(job);

    await this.auditLogService.log({
      action: AuditAction.UPDATE,
      resourceType: AuditResourceType.SYSTEM,
      resourceId: job.id,
      actor: job.requestedByUserId ?? 'system',
      description: 'Blockchain replay job failed',
      errorMessage: message,
      success: false,
    });
  }
}
