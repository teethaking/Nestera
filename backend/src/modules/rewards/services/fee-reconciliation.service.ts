import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, DeepPartial } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  FeeReconciliation,
  ReconciliationStatus,
  ReconciliationType,
} from '../entities/fee-reconciliation.entity';
import { ShutdownTrackedTask } from '../../../common/decorators/shutdown-task.decorator';

export interface ReconciliationResult {
  totalChecked: number;
  matched: number;
  discrepancies: number;
  totalDiscrepancyAmount: number;
}

@Injectable()
export class FeeReconciliationService {
  private readonly logger = new Logger(FeeReconciliationService.name);
  private readonly DISCREPANCY_THRESHOLD = 0.001;

  constructor(
    @InjectRepository(FeeReconciliation)
    private readonly reconciliationRepo: Repository<FeeReconciliation>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async reconcile(
    referenceType: ReconciliationType,
    referenceId: string,
    userId: string,
    expectedAmount: number,
    actualAmount: number,
    notes?: string,
  ): Promise<FeeReconciliation> {
    const difference = expectedAmount - actualAmount;
    const absDiff = Math.abs(difference);
    const discrepancyPercentage =
      expectedAmount > 0 ? (absDiff / expectedAmount) * 100 : 0;

    const status =
      absDiff <= this.DISCREPANCY_THRESHOLD
        ? ReconciliationStatus.RECONCILED
        : ReconciliationStatus.DISCREPANCY;

    const reconciliation = this.reconciliationRepo.create({
      referenceType,
      referenceId,
      userId,
      expectedAmount,
      actualAmount,
      difference,
      discrepancyPercentage: Number(discrepancyPercentage.toFixed(3)),
      status,
      notes: notes ?? undefined,
      reconciledAt:
        status === ReconciliationStatus.RECONCILED ? new Date() : undefined,
    } as unknown as DeepPartial<FeeReconciliation>) as unknown as FeeReconciliation;

    const saved = await this.reconciliationRepo.save(
      reconciliation,
    ) as unknown as FeeReconciliation;

    if (status === ReconciliationStatus.DISCREPANCY) {
      this.eventEmitter.emit('reconciliation.discrepancy', {
        reconciliationId: saved.id,
        referenceType,
        referenceId,
        userId,
        expectedAmount,
        actualAmount,
        difference,
        discrepancyPercentage,
      });
      this.logger.warn(
        `Reconciliation discrepancy: ${referenceType} ${referenceId} differs by ${difference}`,
      );
    }

    return saved;
  }

  async resolveDiscrepancy(
    reconciliationId: string,
    resolvedBy: string,
    actualAmount: number,
    notes?: string,
  ): Promise<FeeReconciliation> {
    const record = await this.reconciliationRepo.findOne({
      where: { id: reconciliationId },
    });
    if (!record) {
      throw new Error(`Reconciliation record ${reconciliationId} not found`);
    }

    record.actualAmount = actualAmount;
    record.difference = record.expectedAmount - actualAmount;
    record.status = ReconciliationStatus.RECONCILED;
    record.reconciledAt = new Date();
    record.reconciledBy = resolvedBy;
    record.notes = notes ?? null;

    return this.reconciliationRepo.save(record);
  }

  async getDiscrepancies(options?: {
    type?: ReconciliationType;
    limit?: number;
    offset?: number;
  }): Promise<FeeReconciliation[]> {
    const where: Record<string, unknown> = {
      status: ReconciliationStatus.DISCREPANCY,
    };
    if (options?.type) {
      where.referenceType = options.type;
    }
    return this.reconciliationRepo.find({
      where,
      order: { createdAt: 'DESC' },
      take: options?.limit ?? 50,
      skip: options?.offset ?? 0,
    });
  }

  async getReconciliationHistory(
    userId: string,
    options?: {
      type?: ReconciliationType;
      limit?: number;
      offset?: number;
    },
  ): Promise<FeeReconciliation[]> {
    const where: Record<string, unknown> = { userId };
    if (options?.type) {
      where.referenceType = options.type;
    }
    return this.reconciliationRepo.find({
      where,
      order: { createdAt: 'DESC' },
      take: options?.limit ?? 50,
      skip: options?.offset ?? 0,
    });
  }

  async getReconciliationStats(userId: string): Promise<{
    totalReconciled: number;
    totalDiscrepancies: number;
    totalDifference: number;
  }> {
    const records = await this.reconciliationRepo.find({ where: { userId } });

    return {
      totalReconciled: records.filter(
        (r) => r.status === ReconciliationStatus.RECONCILED,
      ).length,
      totalDiscrepancies: records.filter(
        (r) => r.status === ReconciliationStatus.DISCREPANCY,
      ).length,
      totalDifference: records.reduce(
        (sum, r) => sum + Number(r.difference),
        0,
      ),
    };
  }

  @ShutdownTrackedTask()
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async cleanupResolvedRecords(): Promise<void> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const result = await this.reconciliationRepo.delete({
      status: ReconciliationStatus.RECONCILED,
      reconciledAt: Between(new Date('1970-01-01'), cutoff),
    });
    this.logger.log(
      `Cleaned up ${result.affected} resolved reconciliation records`,
    );
  }
}
