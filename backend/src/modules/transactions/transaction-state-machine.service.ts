import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Transaction, TxStatus } from './entities/transaction.entity';
import { TransactionStatusTransition } from './entities/transaction-status-transition.entity';

type TransitionContext = {
  actor?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
  manager?: EntityManager;
};

type CreateTransactionInput = Pick<Transaction, 'userId' | 'type' | 'amount'> &
  Partial<
    Pick<
      Transaction,
      | 'status'
      | 'txHash'
      | 'publicKey'
      | 'eventId'
      | 'ledgerSequence'
      | 'poolId'
      | 'metadata'
      | 'flagged'
      | 'category'
      | 'tags'
    >
  >;

const ALLOWED_TRANSITIONS: Record<TxStatus, readonly TxStatus[]> = {
  [TxStatus.CREATED]: [TxStatus.PENDING_CONFIRMATION, TxStatus.CONFIRMED, TxStatus.FAILED],
  [TxStatus.PENDING_CONFIRMATION]: [
    TxStatus.CONFIRMED,
    TxStatus.FAILED,
    TxStatus.REVERSED,
    TxStatus.DISPUTED,
  ],
  [TxStatus.CONFIRMED]: [
    TxStatus.COMPLETED,
    TxStatus.FAILED,
    TxStatus.REVERSED,
    TxStatus.DISPUTED,
  ],
  [TxStatus.COMPLETED]: [TxStatus.REVERSED, TxStatus.DISPUTED],
  [TxStatus.FAILED]: [TxStatus.DISPUTED],
  [TxStatus.REVERSED]: [],
  [TxStatus.DISPUTED]: [TxStatus.REVERSED, TxStatus.COMPLETED, TxStatus.FAILED],
  // Legacy compatibility with pre-state-machine records.
  [TxStatus.PENDING]: [TxStatus.CONFIRMED, TxStatus.FAILED, TxStatus.REVERSED, TxStatus.DISPUTED],
};

@Injectable()
export class TransactionStateMachineService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepository: Repository<Transaction>,
    @InjectRepository(TransactionStatusTransition)
    private readonly transitionRepository: Repository<TransactionStatusTransition>,
  ) {}

  async createTransaction(
    input: CreateTransactionInput,
    context: TransitionContext = {},
  ): Promise<Transaction> {
    const txRepo = this.getTransactionRepo(context.manager);
    const auditRepo = this.getTransitionRepo(context.manager);

    const initialStatus = (input.status as TxStatus | undefined) ?? TxStatus.CREATED;
    if (initialStatus !== TxStatus.CREATED) {
      throw new BadRequestException(
        `New transactions must start at ${TxStatus.CREATED}; received ${initialStatus}`,
      );
    }

    const created = await txRepo.save(
      txRepo.create({
        ...input,
        status: TxStatus.CREATED,
      }),
    );

    await this.recordAudit(auditRepo, {
      transactionId: created.id,
      fromStatus: null,
      toStatus: TxStatus.CREATED,
      actor: context.actor,
      reason: context.reason ?? 'Transaction created',
      metadata: context.metadata,
    });

    return created;
  }

  async transitionStatus(
    transactionId: string,
    nextStatus: TxStatus,
    context: TransitionContext = {},
  ): Promise<Transaction> {
    const txRepo = this.getTransactionRepo(context.manager);
    const auditRepo = this.getTransitionRepo(context.manager);
    const transaction = await txRepo.findOne({ where: { id: transactionId } });

    if (!transaction) {
      throw new NotFoundException(`Transaction ${transactionId} not found`);
    }

    const currentStatus = transaction.status ?? TxStatus.CREATED;
    this.ensureTransitionAllowed(currentStatus, nextStatus);

    transaction.status = nextStatus;
    const updated = await txRepo.save(transaction);

    await this.recordAudit(auditRepo, {
      transactionId: transaction.id,
      fromStatus: currentStatus,
      toStatus: nextStatus,
      actor: context.actor,
      reason: context.reason,
      metadata: context.metadata,
    });

    return updated;
  }

  private ensureTransitionAllowed(current: TxStatus, next: TxStatus): void {
    if (current === next) {
      throw new BadRequestException(
        `Illegal transaction status transition: ${current} -> ${next} (no-op)`,
      );
    }
    const allowed = ALLOWED_TRANSITIONS[current] ?? [];
    if (!allowed.includes(next)) {
      throw new BadRequestException(
        `Illegal transaction status transition: ${current} -> ${next}`,
      );
    }
  }

  private async recordAudit(
    repo: Repository<TransactionStatusTransition>,
    data: {
      transactionId: string;
      fromStatus: TxStatus | null;
      toStatus: TxStatus;
      actor?: string;
      reason?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<void> {
    await repo.save(
      repo.create({
        transactionId: data.transactionId,
        fromStatus: data.fromStatus,
        toStatus: data.toStatus,
        actor: data.actor ?? 'system',
        reason: data.reason ?? null,
        metadata: data.metadata ?? null,
      }),
    );
  }

  private getTransactionRepo(manager?: EntityManager): Repository<Transaction> {
    return manager
      ? manager.getRepository(Transaction)
      : this.transactionRepository;
  }

  private getTransitionRepo(
    manager?: EntityManager,
  ): Repository<TransactionStatusTransition> {
    return manager
      ? manager.getRepository(TransactionStatusTransition)
      : this.transitionRepository;
  }
}
