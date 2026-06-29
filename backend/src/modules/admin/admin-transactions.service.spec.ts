import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { AdminTransactionsService } from './admin-transactions.service';
import {
  Transaction,
  TxType,
  TxStatus,
} from '../transactions/entities/transaction.entity';
import { AdminTransactionNote } from './entities/admin-transaction-note.entity';
import { AdminTransactionFilterDto } from './dto/admin-transaction-filter.dto';

describe('AdminTransactionsService', () => {
  let service: AdminTransactionsService;
  let txRepo: Repository<Transaction>;
  let noteRepo: Repository<AdminTransactionNote>;
  let mockQueryBuilder: Partial<SelectQueryBuilder<Transaction>>;

  beforeEach(async () => {
    // Create a mock query builder with chainable methods
    mockQueryBuilder = {
      andWhere: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      getMany: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminTransactionsService,
        {
          provide: getRepositoryToken(Transaction),
          useValue: {
            createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
            findOne: jest.fn(),
            update: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(AdminTransactionNote),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AdminTransactionsService>(AdminTransactionsService);
    txRepo = module.get<Repository<Transaction>>(
      getRepositoryToken(Transaction),
    );
    noteRepo = module.get<Repository<AdminTransactionNote>>(
      getRepositoryToken(AdminTransactionNote),
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll - WHERE clause verification', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should apply type filter with IN clause when type is provided', async () => {
      const query = {
        type: [TxType.DEPOSIT, TxType.WITHDRAW],
      } as AdminTransactionFilterDto;

      await service.findAll(query);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'tx.type IN (:...type)',
        { type: [TxType.DEPOSIT, TxType.WITHDRAW] },
      );
    });

    it('should apply status filter with IN clause when status is provided', async () => {
      const query = {
        status: [TxStatus.COMPLETED, TxStatus.PENDING],
      } as AdminTransactionFilterDto;

      await service.findAll(query);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'tx.status IN (:...status)',
        { status: [TxStatus.COMPLETED, TxStatus.PENDING] },
      );
    });

    it('should apply userId filter with equality when userId is provided', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const query = {
        userId,
      } as AdminTransactionFilterDto;

      await service.findAll(query);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'tx.userId = :userId',
        { userId },
      );
    });

    it('should apply minAmount filter with >= comparison when minAmount is provided', async () => {
      const query = {
        minAmount: '100.50',
      } as AdminTransactionFilterDto;

      await service.findAll(query);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'CAST(tx.amount AS DECIMAL) >= :minAmount',
        { minAmount: '100.50' },
      );
    });

    it('should apply maxAmount filter with <= comparison when maxAmount is provided', async () => {
      const query = {
        maxAmount: '500.75',
      } as AdminTransactionFilterDto;

      await service.findAll(query);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'CAST(tx.amount AS DECIMAL) <= :maxAmount',
        { maxAmount: '500.75' },
      );
    });

    it('should apply startDate filter with >= comparison when startDate is provided', async () => {
      const query = {
        startDate: '2024-01-01T00:00:00.000Z',
      } as AdminTransactionFilterDto;

      await service.findAll(query);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'tx.createdAt >= :startDate',
        { startDate: '2024-01-01T00:00:00.000Z' },
      );
    });

    it('should apply endDate filter with <= comparison when endDate is provided', async () => {
      const query = {
        endDate: '2024-12-31T23:59:59.999Z',
      } as AdminTransactionFilterDto;

      await service.findAll(query);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'tx.createdAt <= :endDate',
        { endDate: '2024-12-31T23:59:59.999Z' },
      );
    });

    it('should apply flagged filter with equality when flagged is true', async () => {
      const query = {
        flagged: true,
      } as AdminTransactionFilterDto;

      await service.findAll(query);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'tx.flagged = :flagged',
        { flagged: true },
      );
    });

    it('should apply flagged filter with equality when flagged is false', async () => {
      const query = {
        flagged: false,
      } as AdminTransactionFilterDto;

      await service.findAll(query);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'tx.flagged = :flagged',
        { flagged: false },
      );
    });

    it('should not apply any filters when no filter parameters are provided', async () => {
      const query = {} as AdminTransactionFilterDto;

      await service.findAll(query);

      expect(mockQueryBuilder.andWhere).not.toHaveBeenCalled();
    });

    it('should apply multiple filters in combination - type and status', async () => {
      const query = {
        type: [TxType.DEPOSIT],
        status: [TxStatus.COMPLETED],
      } as AdminTransactionFilterDto;

      await service.findAll(query);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'tx.type IN (:...type)',
        { type: [TxType.DEPOSIT] },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'tx.status IN (:...status)',
        { status: [TxStatus.COMPLETED] },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledTimes(2);
    });

    it('should apply multiple filters in combination - amount range', async () => {
      const query = {
        minAmount: '100',
        maxAmount: '1000',
      } as AdminTransactionFilterDto;

      await service.findAll(query);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'CAST(tx.amount AS DECIMAL) >= :minAmount',
        { minAmount: '100' },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'CAST(tx.amount AS DECIMAL) <= :maxAmount',
        { maxAmount: '1000' },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledTimes(2);
    });

    it('should apply multiple filters in combination - date range', async () => {
      const query = {
        startDate: '2024-01-01T00:00:00.000Z',
        endDate: '2024-12-31T23:59:59.999Z',
      } as AdminTransactionFilterDto;

      await service.findAll(query);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'tx.createdAt >= :startDate',
        { startDate: '2024-01-01T00:00:00.000Z' },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'tx.createdAt <= :endDate',
        { endDate: '2024-12-31T23:59:59.999Z' },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledTimes(2);
    });

    it('should apply all filters in combination', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const query = {
        type: [TxType.DEPOSIT, TxType.WITHDRAW],
        status: [TxStatus.COMPLETED],
        userId,
        minAmount: '100',
        maxAmount: '1000',
        startDate: '2024-01-01T00:00:00.000Z',
        endDate: '2024-12-31T23:59:59.999Z',
        flagged: true,
      } as AdminTransactionFilterDto;

      await service.findAll(query);

      // Verify all 8 filters were applied
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledTimes(8);

      // Verify each specific filter
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'tx.type IN (:...type)',
        { type: [TxType.DEPOSIT, TxType.WITHDRAW] },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'tx.status IN (:...status)',
        { status: [TxStatus.COMPLETED] },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'tx.userId = :userId',
        { userId },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'CAST(tx.amount AS DECIMAL) >= :minAmount',
        { minAmount: '100' },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'CAST(tx.amount AS DECIMAL) <= :maxAmount',
        { maxAmount: '1000' },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'tx.createdAt >= :startDate',
        { startDate: '2024-01-01T00:00:00.000Z' },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'tx.createdAt <= :endDate',
        { endDate: '2024-12-31T23:59:59.999Z' },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'tx.flagged = :flagged',
        { flagged: true },
      );
    });

    it('should apply partial filter combination - type, userId, and flagged', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000';
      const query = {
        type: [TxType.SWAP],
        userId,
        flagged: false,
      } as AdminTransactionFilterDto;

      await service.findAll(query);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledTimes(3);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'tx.type IN (:...type)',
        { type: [TxType.SWAP] },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'tx.userId = :userId',
        { userId },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'tx.flagged = :flagged',
        { flagged: false },
      );
    });

    it('should apply partial filter combination - status, amount range, and date range', async () => {
      const query = {
        status: [TxStatus.FAILED, TxStatus.PENDING],
        minAmount: '50',
        maxAmount: '500',
        startDate: '2024-06-01T00:00:00.000Z',
        endDate: '2024-06-30T23:59:59.999Z',
      } as AdminTransactionFilterDto;

      await service.findAll(query);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledTimes(5);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'tx.status IN (:...status)',
        { status: [TxStatus.FAILED, TxStatus.PENDING] },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'CAST(tx.amount AS DECIMAL) >= :minAmount',
        { minAmount: '50' },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'CAST(tx.amount AS DECIMAL) <= :maxAmount',
        { maxAmount: '500' },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'tx.createdAt >= :startDate',
        { startDate: '2024-06-01T00:00:00.000Z' },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'tx.createdAt <= :endDate',
        { endDate: '2024-06-30T23:59:59.999Z' },
      );
    });

    it('should handle single type in array', async () => {
      const query = {
        type: [TxType.YIELD],
      } as AdminTransactionFilterDto;

      await service.findAll(query);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'tx.type IN (:...type)',
        { type: [TxType.YIELD] },
      );
    });

    it('should handle all transaction types in filter', async () => {
      const query = {
        type: [TxType.DEPOSIT, TxType.WITHDRAW, TxType.SWAP, TxType.YIELD],
      } as AdminTransactionFilterDto;

      await service.findAll(query);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'tx.type IN (:...type)',
        { type: [TxType.DEPOSIT, TxType.WITHDRAW, TxType.SWAP, TxType.YIELD] },
      );
    });

    it('should handle all transaction statuses in filter', async () => {
      const query = {
        status: [TxStatus.COMPLETED, TxStatus.PENDING, TxStatus.FAILED],
      } as AdminTransactionFilterDto;

      await service.findAll(query);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'tx.status IN (:...status)',
        { status: [TxStatus.COMPLETED, TxStatus.PENDING, TxStatus.FAILED] },
      );
    });

    it('should handle minAmount only without maxAmount', async () => {
      const query = {
        minAmount: '1000',
      } as AdminTransactionFilterDto;

      await service.findAll(query);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledTimes(1);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'CAST(tx.amount AS DECIMAL) >= :minAmount',
        { minAmount: '1000' },
      );
    });

    it('should handle maxAmount only without minAmount', async () => {
      const query = {
        maxAmount: '100',
      } as AdminTransactionFilterDto;

      await service.findAll(query);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledTimes(1);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'CAST(tx.amount AS DECIMAL) <= :maxAmount',
        { maxAmount: '100' },
      );
    });

    it('should handle startDate only without endDate', async () => {
      const query = {
        startDate: '2024-01-01T00:00:00.000Z',
      } as AdminTransactionFilterDto;

      await service.findAll(query);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledTimes(1);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'tx.createdAt >= :startDate',
        { startDate: '2024-01-01T00:00:00.000Z' },
      );
    });

    it('should handle endDate only without startDate', async () => {
      const query = {
        endDate: '2024-12-31T23:59:59.999Z',
      } as AdminTransactionFilterDto;

      await service.findAll(query);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledTimes(1);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'tx.createdAt <= :endDate',
        { endDate: '2024-12-31T23:59:59.999Z' },
      );
    });

    it('should return empty paginated response when no transactions match filters', async () => {
      // Mock getManyAndCount to return empty results
      mockQueryBuilder.getManyAndCount = jest.fn().mockResolvedValue([[], 0]);

      const query = {
        type: [TxType.DEPOSIT],
        status: [TxStatus.COMPLETED],
        userId: 'non-existent-user-id',
      } as AdminTransactionFilterDto;

      const result = await service.findAll(query);

      expect(result.data).toEqual([]);
      expect(result.meta.totalItemCount).toBe(0);
      expect(result.meta.pageCount).toBe(0);
    });
  });

  describe('findSuspicious - boundary values', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should NOT flag transaction with amount exactly at threshold (10,000)', async () => {
      const txAtThreshold: Partial<Transaction> = {
        id: 'tx-at-threshold',
        userId: 'user-1',
        type: TxType.DEPOSIT,
        status: TxStatus.COMPLETED,
        amount: '10000',
        flagged: false,
        createdAt: new Date(),
        publicKey: null,
        eventId: null,
        ledgerSequence: null,
        poolId: null,
        metadata: null,
        category: null,
        tags: [],
        txHash: null,
      };

      // Mock the large amount query to return empty (amount must be > 10,000)
      const largeAmountQB = {
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      // Mock the high velocity query to return empty
      const highVelocityQB = {
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      // Mock the repeated failures query to return empty
      const repeatedFailuresQB = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      // Mock createQueryBuilder to return different query builders for each call
      let callCount = 0;
      jest.spyOn(txRepo, 'createQueryBuilder').mockImplementation(() => {
        callCount++;
        if (callCount === 1) return largeAmountQB as any;
        if (callCount === 2) return highVelocityQB as any;
        return repeatedFailuresQB as any;
      });

      const result = await service.findSuspicious({ skip: 0, limit: 10 } as any);

      expect(result.data).toEqual([]);
      expect(result.meta.totalItemCount).toBe(0);
      expect(largeAmountQB.where).toHaveBeenCalledWith(
        'CAST(tx.amount AS DECIMAL) > :threshold',
        { threshold: 10_000 },
      );
    });

    it('should flag transaction with amount one unit above threshold (10,001)', async () => {
      const txAboveThreshold: Partial<Transaction> = {
        id: 'tx-above-threshold',
        userId: 'user-1',
        type: TxType.DEPOSIT,
        status: TxStatus.COMPLETED,
        amount: '10001',
        flagged: false,
        createdAt: new Date(),
        publicKey: null,
        eventId: null,
        ledgerSequence: null,
        poolId: null,
        metadata: null,
        category: null,
        tags: [],
        txHash: null,
      };

      // Mock the large amount query to return the transaction
      const largeAmountQB = {
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([txAboveThreshold]),
      };

      // Mock the high velocity query to return empty
      const highVelocityQB = {
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      // Mock the repeated failures query to return empty
      const repeatedFailuresQB = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      // Mock createQueryBuilder to return different query builders for each call
      let callCount = 0;
      jest.spyOn(txRepo, 'createQueryBuilder').mockImplementation(() => {
        callCount++;
        if (callCount === 1) return largeAmountQB as any;
        if (callCount === 2) return highVelocityQB as any;
        return repeatedFailuresQB as any;
      });

      const result = await service.findSuspicious({ skip: 0, limit: 10 } as any);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('tx-above-threshold');
      expect(result.data[0].amount).toBe('10001');
      expect(result.data[0].reasons).toContain(
        'Amount exceeds threshold of 10000 units',
      );
      expect(largeAmountQB.where).toHaveBeenCalledWith(
        'CAST(tx.amount AS DECIMAL) > :threshold',
        { threshold: 10_000 },
      );
    });

    it('should flag transaction with amount slightly above threshold (10,000.01)', async () => {
      const txSlightlyAboveThreshold: Partial<Transaction> = {
        id: 'tx-slightly-above',
        userId: 'user-1',
        type: TxType.DEPOSIT,
        status: TxStatus.COMPLETED,
        amount: '10000.01',
        flagged: false,
        createdAt: new Date(),
        publicKey: null,
        eventId: null,
        ledgerSequence: null,
        poolId: null,
        metadata: null,
        category: null,
        tags: [],
        txHash: null,
      };

      // Mock the large amount query to return the transaction
      const largeAmountQB = {
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([txSlightlyAboveThreshold]),
      };

      // Mock the high velocity query to return empty
      const highVelocityQB = {
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      // Mock the repeated failures query to return empty
      const repeatedFailuresQB = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      // Mock createQueryBuilder to return different query builders for each call
      let callCount = 0;
      jest.spyOn(txRepo, 'createQueryBuilder').mockImplementation(() => {
        callCount++;
        if (callCount === 1) return largeAmountQB as any;
        if (callCount === 2) return highVelocityQB as any;
        return repeatedFailuresQB as any;
      });

      const result = await service.findSuspicious({ skip: 0, limit: 10 } as any);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('tx-slightly-above');
      expect(result.data[0].amount).toBe('10000.01');
      expect(result.data[0].reasons).toContain(
        'Amount exceeds threshold of 10000 units',
      );
      expect(largeAmountQB.where).toHaveBeenCalledWith(
        'CAST(tx.amount AS DECIMAL) > :threshold',
        { threshold: 10_000 },
      );
    });

    it('should NOT flag user with exactly 10 transactions in 1-hour window', async () => {
      const now = new Date();
      const userId = 'user-velocity-test';

      // Create 10 transactions within 1-hour window (exactly at threshold)
      const tenTransactions: Partial<Transaction>[] = Array.from(
        { length: 10 },
        (_, i) => ({
          id: `tx-velocity-${i}`,
          userId,
          type: TxType.DEPOSIT,
          status: TxStatus.COMPLETED,
          amount: '100',
          flagged: false,
          createdAt: new Date(now.getTime() - i * 5 * 60 * 1000), // Spread over 45 minutes
          publicKey: null,
          eventId: null,
          ledgerSequence: null,
          poolId: null,
          metadata: null,
          category: null,
          tags: [],
          txHash: null,
        }),
      );

      // Mock the large amount query to return empty
      const largeAmountQB = {
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      // Mock the high velocity query to return empty (10 is not > 10)
      const highVelocityQB = {
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      // Mock the repeated failures query to return empty
      const repeatedFailuresQB = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      // Mock createQueryBuilder to return different query builders for each call
      let callCount = 0;
      jest.spyOn(txRepo, 'createQueryBuilder').mockImplementation(() => {
        callCount++;
        if (callCount === 1) return largeAmountQB as any;
        if (callCount === 2) return highVelocityQB as any;
        return repeatedFailuresQB as any;
      });

      const result = await service.findSuspicious({ skip: 0, limit: 10 } as any);

      expect(result.data).toEqual([]);
      expect(result.meta.totalItemCount).toBe(0);
      expect(highVelocityQB.where).toHaveBeenCalledWith(
        expect.stringContaining('> :velocityMaxCount'),
        { velocityMaxCount: 10 },
      );
    });

    it('should flag user with 11 transactions (N+1) in 1-hour window', async () => {
      const now = new Date();
      const userId = 'user-velocity-test-11';

      // Create 11 transactions within 1-hour window (one above threshold)
      const elevenTransactions: Partial<Transaction>[] = Array.from(
        { length: 11 },
        (_, i) => ({
          id: `tx-velocity-11-${i}`,
          userId,
          type: TxType.DEPOSIT,
          status: TxStatus.COMPLETED,
          amount: '100',
          flagged: false,
          createdAt: new Date(now.getTime() - i * 5 * 60 * 1000), // Spread over 50 minutes
          publicKey: null,
          eventId: null,
          ledgerSequence: null,
          poolId: null,
          metadata: null,
          category: null,
          tags: [],
          txHash: null,
        }),
      );

      // Mock the large amount query to return empty
      const largeAmountQB = {
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      // Mock the high velocity query to return the transactions (11 is > 10)
      const highVelocityQB = {
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(elevenTransactions),
      };

      // Mock the repeated failures query to return empty
      const repeatedFailuresQB = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      // Mock createQueryBuilder to return different query builders for each call
      let callCount = 0;
      jest.spyOn(txRepo, 'createQueryBuilder').mockImplementation(() => {
        callCount++;
        if (callCount === 1) return largeAmountQB as any;
        if (callCount === 2) return highVelocityQB as any;
        return repeatedFailuresQB as any;
      });

      const result = await service.findSuspicious({ skip: 0, limit: 20 } as any);

      expect(result.data.length).toBeGreaterThan(0);
      // All 11 transactions should be flagged
      expect(result.data).toHaveLength(11);
      // Verify each transaction has the high velocity reason
      result.data.forEach((tx) => {
        expect(tx.reasons).toContain(
          'User submitted more than 10 transactions within a 1-hour window',
        );
      });
      expect(highVelocityQB.where).toHaveBeenCalledWith(
        expect.stringContaining('> :velocityMaxCount'),
        { velocityMaxCount: 10 },
      );
    });

    it('should NOT flag user with exactly 3 FAILED transactions (N) in 24-hour window', async () => {
      const now = new Date();
      const userId = 'user-failure-test-3';

      // Create exactly 3 FAILED transactions within 24-hour window (at threshold)
      const threeFailures: Partial<Transaction>[] = Array.from(
        { length: 3 },
        (_, i) => ({
          id: `tx-failure-3-${i}`,
          userId,
          type: TxType.DEPOSIT,
          status: TxStatus.FAILED,
          amount: '100',
          flagged: false,
          createdAt: new Date(now.getTime() - i * 6 * 60 * 60 * 1000), // Spread over 12 hours
          publicKey: null,
          eventId: null,
          ledgerSequence: null,
          poolId: null,
          metadata: null,
          category: null,
          tags: [],
          txHash: null,
        }),
      );

      // Mock the large amount query to return empty
      const largeAmountQB = {
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      // Mock the high velocity query to return empty
      const highVelocityQB = {
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      // Mock the repeated failures query to return empty (3 is not > 3)
      const repeatedFailuresQB = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      // Mock createQueryBuilder to return different query builders for each call
      let callCount = 0;
      jest.spyOn(txRepo, 'createQueryBuilder').mockImplementation(() => {
        callCount++;
        if (callCount === 1) return largeAmountQB as any;
        if (callCount === 2) return highVelocityQB as any;
        return repeatedFailuresQB as any;
      });

      const result = await service.findSuspicious({ skip: 0, limit: 10 } as any);

      expect(result.data).toEqual([]);
      expect(result.meta.totalItemCount).toBe(0);
      expect(repeatedFailuresQB.where).toHaveBeenCalledWith(
        `tx.status = 'FAILED'`,
      );
      expect(repeatedFailuresQB.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('> :failureMaxCount'),
        { failureMaxCount: 3 },
      );
    });

    it('should flag user with 4 FAILED transactions (N+1) in 24-hour window', async () => {
      const now = new Date();
      const userId = 'user-failure-test-4';

      // Create 4 FAILED transactions within 24-hour window (one above threshold)
      const fourFailures: Partial<Transaction>[] = Array.from(
        { length: 4 },
        (_, i) => ({
          id: `tx-failure-4-${i}`,
          userId,
          type: TxType.DEPOSIT,
          status: TxStatus.FAILED,
          amount: '100',
          flagged: false,
          createdAt: new Date(now.getTime() - i * 5 * 60 * 60 * 1000), // Spread over 15 hours
          publicKey: null,
          eventId: null,
          ledgerSequence: null,
          poolId: null,
          metadata: null,
          category: null,
          tags: [],
          txHash: null,
        }),
      );

      // Mock the large amount query to return empty
      const largeAmountQB = {
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      // Mock the high velocity query to return empty
      const highVelocityQB = {
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      // Mock the repeated failures query to return the transactions (4 is > 3)
      const repeatedFailuresQB = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(fourFailures),
      };

      // Mock createQueryBuilder to return different query builders for each call
      let callCount = 0;
      jest.spyOn(txRepo, 'createQueryBuilder').mockImplementation(() => {
        callCount++;
        if (callCount === 1) return largeAmountQB as any;
        if (callCount === 2) return highVelocityQB as any;
        return repeatedFailuresQB as any;
      });

      const result = await service.findSuspicious({ skip: 0, limit: 20 } as any);

      expect(result.data.length).toBeGreaterThan(0);
      // All 4 transactions should be flagged
      expect(result.data).toHaveLength(4);
      // Verify each transaction has the repeated failures reason
      result.data.forEach((tx) => {
        expect(tx.reasons).toContain(
          'User has more than 3 failed transactions within a 24-hour window',
        );
      });
      expect(repeatedFailuresQB.where).toHaveBeenCalledWith(
        `tx.status = 'FAILED'`,
      );
      expect(repeatedFailuresQB.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('> :failureMaxCount'),
        { failureMaxCount: 3 },
      );
    });
  });

  describe('getStats - average amount calculation', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should calculate averageAmount = totalVolume / count for a known dataset', async () => {
      // Create a known dataset: 3 transactions with amounts 100, 200, 300
      // Expected: count = 3, totalVolume = 600, averageAmount = 200
      const mockStatsResult = [
        {
          period: new Date('2024-01-15T00:00:00.000Z'),
          type: TxType.DEPOSIT,
          count: '3',
          totalVolume: '600',
          averageAmount: '200',
        },
      ];

      // Mock the query builder chain for getStats
      const statsQB = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        setParameter: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        addGroupBy: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(mockStatsResult),
      };

      jest.spyOn(txRepo, 'createQueryBuilder').mockReturnValue(statsQB as any);

      const query = {
        period: 'daily' as const,
        startDate: '2024-01-15T00:00:00.000Z',
        endDate: '2024-01-15T23:59:59.999Z',
      };

      const result = await service.getStats(query);

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe(TxType.DEPOSIT);
      expect(result[0].count).toBe(3);
      expect(result[0].totalVolume).toBe('600');
      expect(result[0].averageAmount).toBe('200');

      // Verify averageAmount = totalVolume / count
      const totalVolume = parseFloat(result[0].totalVolume);
      const count = result[0].count;
      const averageAmount = parseFloat(result[0].averageAmount);
      expect(averageAmount).toBe(totalVolume / count);
    });
  });

  describe('flagTransaction', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should throw NotFoundException when transaction does not exist', async () => {
      const nonExistentId = 'non-existent-id';

      jest.spyOn(txRepo, 'findOne').mockResolvedValue(null);

      await expect(
        service.flagTransaction(nonExistentId, true),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.flagTransaction(nonExistentId, true),
      ).rejects.toThrow(`Transaction ${nonExistentId} not found`);

      expect(txRepo.findOne).toHaveBeenCalledWith({
        where: { id: nonExistentId },
      });
      expect(txRepo.update).not.toHaveBeenCalled();
    });

    it('should successfully update and return transaction when flagging to true', async () => {
      const transactionId = 'existing-tx-id';
      const existingTransaction: Partial<Transaction> = {
        id: transactionId,
        userId: 'user-123',
        type: TxType.DEPOSIT,
        status: TxStatus.COMPLETED,
        amount: '1000',
        flagged: false,
        createdAt: new Date('2024-01-15T10:00:00.000Z'),
        publicKey: null,
        eventId: null,
        ledgerSequence: null,
        poolId: null,
        metadata: null,
        category: null,
        tags: [],
        txHash: null,
      };

      const updatedTransaction: Partial<Transaction> = {
        ...existingTransaction,
        flagged: true,
      };

      // Mock findOne to return existing transaction on first call
      // and updated transaction on second call
      jest
        .spyOn(txRepo, 'findOne')
        .mockResolvedValueOnce(existingTransaction as Transaction)
        .mockResolvedValueOnce(updatedTransaction as Transaction);

      jest.spyOn(txRepo, 'update').mockResolvedValue({} as any);

      const result = await service.flagTransaction(transactionId, true);

      expect(txRepo.findOne).toHaveBeenCalledTimes(2);
      expect(txRepo.findOne).toHaveBeenNthCalledWith(1, {
        where: { id: transactionId },
      });
      expect(txRepo.update).toHaveBeenCalledWith(transactionId, {
        flagged: true,
      });
      expect(txRepo.findOne).toHaveBeenNthCalledWith(2, {
        where: { id: transactionId },
      });
      expect(result.flagged).toBe(true);
      expect(result.id).toBe(transactionId);
    });

    it('should successfully update and return transaction when flagging to false', async () => {
      const transactionId = 'existing-tx-id-2';
      const existingTransaction: Partial<Transaction> = {
        id: transactionId,
        userId: 'user-456',
        type: TxType.WITHDRAW,
        status: TxStatus.PENDING,
        amount: '500',
        flagged: true,
        createdAt: new Date('2024-01-16T12:00:00.000Z'),
        publicKey: null,
        eventId: null,
        ledgerSequence: null,
        poolId: null,
        metadata: null,
        category: null,
        tags: [],
        txHash: null,
      };

      const updatedTransaction: Partial<Transaction> = {
        ...existingTransaction,
        flagged: false,
      };

      jest
        .spyOn(txRepo, 'findOne')
        .mockResolvedValueOnce(existingTransaction as Transaction)
        .mockResolvedValueOnce(updatedTransaction as Transaction);

      jest.spyOn(txRepo, 'update').mockResolvedValue({} as any);

      const result = await service.flagTransaction(transactionId, false);

      expect(txRepo.findOne).toHaveBeenCalledTimes(2);
      expect(txRepo.update).toHaveBeenCalledWith(transactionId, {
        flagged: false,
      });
      expect(result.flagged).toBe(false);
      expect(result.id).toBe(transactionId);
    });
  });

  describe('addNote', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should throw NotFoundException when transaction does not exist', async () => {
      const nonExistentId = 'non-existent-tx-id';
      const adminId = 'admin-123';
      const content = 'This is a test note';

      jest.spyOn(txRepo, 'findOne').mockResolvedValue(null);

      await expect(
        service.addNote(nonExistentId, adminId, content),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.addNote(nonExistentId, adminId, content),
      ).rejects.toThrow(`Transaction ${nonExistentId} not found`);

      expect(txRepo.findOne).toHaveBeenCalledWith({
        where: { id: nonExistentId },
      });
      expect(noteRepo.create).not.toHaveBeenCalled();
      expect(noteRepo.save).not.toHaveBeenCalled();
    });

    it('should successfully create and return note when transaction exists and content is valid', async () => {
      const transactionId = 'existing-tx-id';
      const adminId = 'admin-456';
      const content = 'Reviewed — appears legitimate.';

      const existingTransaction: Partial<Transaction> = {
        id: transactionId,
        userId: 'user-789',
        type: TxType.DEPOSIT,
        status: TxStatus.COMPLETED,
        amount: '5000',
        flagged: false,
        createdAt: new Date('2024-01-20T14:30:00.000Z'),
        publicKey: null,
        eventId: null,
        ledgerSequence: null,
        poolId: null,
        metadata: null,
        category: null,
        tags: [],
        txHash: null,
      };

      const createdNote: Partial<AdminTransactionNote> = {
        id: 'note-uuid-123',
        transactionId,
        adminId,
        content,
        createdAt: new Date('2024-01-20T15:00:00.000Z'),
      };

      jest
        .spyOn(txRepo, 'findOne')
        .mockResolvedValue(existingTransaction as Transaction);
      jest
        .spyOn(noteRepo, 'create')
        .mockReturnValue(createdNote as AdminTransactionNote);
      jest
        .spyOn(noteRepo, 'save')
        .mockResolvedValue(createdNote as AdminTransactionNote);

      const result = await service.addNote(transactionId, adminId, content);

      expect(txRepo.findOne).toHaveBeenCalledWith({
        where: { id: transactionId },
      });
      expect(noteRepo.create).toHaveBeenCalledWith({
        transactionId,
        adminId,
        content,
      });
      expect(noteRepo.save).toHaveBeenCalledWith(createdNote);
      expect(result.id).toBe('note-uuid-123');
      expect(result.transactionId).toBe(transactionId);
      expect(result.adminId).toBe(adminId);
      expect(result.content).toBe(content);
      expect(result.createdAt).toBeDefined();
    });
  });

  describe('streamCsv', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should call stream.end() when no transactions match the filter', async () => {
      // Mock query builder to return empty results
      const emptyQueryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      jest
        .spyOn(txRepo, 'createQueryBuilder')
        .mockReturnValue(emptyQueryBuilder as any);

      // Mock CSV stream
      const mockStream = {
        write: jest.fn(),
        end: jest.fn(),
      };

      const query = {
        type: [TxType.DEPOSIT],
        status: [TxStatus.COMPLETED],
        userId: 'non-existent-user',
      } as AdminTransactionFilterDto;

      await service.streamCsv(query, mockStream as any);

      // Verify stream.end() was called
      expect(mockStream.end).toHaveBeenCalledTimes(1);
      // Verify stream.write() was never called (no data rows)
      expect(mockStream.write).not.toHaveBeenCalled();
      // Verify query was executed
      expect(emptyQueryBuilder.skip).toHaveBeenCalledWith(0);
      expect(emptyQueryBuilder.take).toHaveBeenCalledWith(500);
      expect(emptyQueryBuilder.getMany).toHaveBeenCalledTimes(1);
    });
  });
});
