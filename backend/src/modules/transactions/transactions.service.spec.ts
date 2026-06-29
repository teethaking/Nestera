import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TransactionSavedSearch } from './entities/transaction-saved-search.entity';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { TransactionsService } from './transactions.service';
import {
  LedgerTransaction,
  LedgerTransactionType,
} from '../blockchain/entities/transaction.entity';
import { TransactionQueryDto } from './dto/transaction-query.dto';
import { Order } from '../../common/dto/page-options.dto';

describe('TransactionsService', () => {
  let service: TransactionsService;
  let repository: Repository<LedgerTransaction>;

  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn(),
  };

  const mockRepository = {
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        {
          provide: getRepositoryToken(LedgerTransaction),
          useValue: mockRepository,
        },
        {
          provide: getRepositoryToken(TransactionSavedSearch),
          useValue: { find: jest.fn(), findOne: jest.fn(), save: jest.fn(), create: jest.fn(), delete: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
    repository = module.get<Repository<LedgerTransaction>>(
      getRepositoryToken(LedgerTransaction),
    );

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAllForUser', () => {
    const userId = 'test-user-id';
    const mockTransactions: Partial<LedgerTransaction>[] = [
      {
        id: '1',
        userId,
        type: LedgerTransactionType.DEPOSIT,
        amount: '100.50',
        publicKey: 'GTEST123',
        eventId: 'event-1',
        transactionHash: 'hash-1',
        ledgerSequence: '12345',
        poolId: 'pool-1',
        metadata: { test: 'data' },
        createdAt: new Date('2024-01-15T10:30:00Z'),
      },
    ];

    it('should return paginated transactions for a user', async () => {
      const queryDto = Object.assign(new TransactionQueryDto(), {
        page: 1,
        limit: 10,
        order: Order.DESC,
      });

      mockQueryBuilder.getManyAndCount.mockResolvedValue([
        mockTransactions as LedgerTransaction[],
        1,
      ]);

      const result = await service.findAllForUser(userId, queryDto);

      expect(mockRepository.createQueryBuilder).toHaveBeenCalledWith(
        'transaction',
      );
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'transaction.userId = :userId',
        { userId },
      );
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        'transaction.createdAt',
        'DESC',
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0].userId).toBe(userId);
      expect(result.data[0].formattedDate).toBeDefined();
      expect(result.data[0].formattedTime).toBeDefined();
      expect(result.meta.totalItemCount).toBe(1);
    });

    it('should filter by transaction types', async () => {
      const queryDto = Object.assign(new TransactionQueryDto(), {
        page: 1,
        limit: 10,
        type: [LedgerTransactionType.DEPOSIT, LedgerTransactionType.YIELD],
      });

      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAllForUser(userId, queryDto);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'transaction.type IN (:...types)',
        { types: queryDto.type },
      );
    });

    it('should filter by date range', async () => {
      const queryDto = Object.assign(new TransactionQueryDto(), {
        page: 1,
        limit: 10,
        startDate: '2024-01-01T00:00:00.000Z',
        endDate: '2024-12-31T23:59:59.999Z',
      });

      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAllForUser(userId, queryDto);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'transaction.createdAt >= :startDate',
        { startDate: new Date(queryDto.startDate) },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'transaction.createdAt <= :endDate',
        { endDate: new Date(queryDto.endDate) },
      );
    });

    it('should filter by pool ID', async () => {
      const queryDto = Object.assign(new TransactionQueryDto(), {
        page: 1,
        limit: 10,
        poolId: 'pool-123',
      });

      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAllForUser(userId, queryDto);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'transaction.poolId = :poolId',
        { poolId: 'pool-123' },
      );
    });

    it('should apply pagination correctly', async () => {
      const queryDto = Object.assign(new TransactionQueryDto(), {
        page: 2,
        limit: 50,
      });

      mockQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAllForUser(userId, queryDto);

      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(50); // (page 2 - 1) * 50
      expect(mockQueryBuilder.take).toHaveBeenCalledWith(50);
    });
  });

  describe('createSavedSearch', () => {
    it('should create a saved search for a user', async () => {
      const userId = 'test-user-id';
      const dto = { name: 'My Search', filters: { type: ['DEPOSIT'] }, isDefault: false };
      const savedSearch = { id: '1', userId, ...dto, createdAt: new Date() };

      mockSavedSearchRepository.create.mockReturnValue(savedSearch);
      mockSavedSearchRepository.save.mockResolvedValue(savedSearch);
      mockSavedSearchRepository.find.mockResolvedValue([]);

      const result = await service.createSavedSearch(userId, dto as any);

      expect(mockSavedSearchRepository.create).toHaveBeenCalled();
      expect(mockSavedSearchRepository.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('listSavedSearches', () => {
    it('should return saved searches for a user', async () => {
      const userId = 'test-user-id';
      const searches = [
        { id: '1', userId, name: 'Search 1', filters: {}, isDefault: false, createdAt: new Date() },
      ];

      mockSavedSearchRepository.find.mockResolvedValue(searches);

      const result = await service.listSavedSearches(userId);

      expect(mockSavedSearchRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId } }),
      );
      expect(result).toHaveLength(1);
    });

    it('should return empty array when no saved searches exist', async () => {
      mockSavedSearchRepository.find.mockResolvedValue([]);
      const result = await service.listSavedSearches('user-id');
      expect(result).toHaveLength(0);
    });
  });

  describe('updateSavedSearch', () => {
    it('should update a saved search belonging to the user', async () => {
      const userId = 'test-user-id';
      const id = 'search-1';
      const dto = { name: 'Updated Search' };
      const existing = { id, userId, name: 'Old Search', filters: {}, isDefault: false };
      const updated = { ...existing, ...dto };

      mockSavedSearchRepository.findOne.mockResolvedValue(existing);
      mockSavedSearchRepository.save.mockResolvedValue(updated);

      const result = await service.updateSavedSearch(userId, id, dto as any);

      expect(mockSavedSearchRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id, userId } }),
      );
      expect(result).toBeDefined();
    });

    it('should return error when saved search not found', async () => {
      mockSavedSearchRepository.findOne.mockResolvedValue(null);
      const result = await service.updateSavedSearch('user-id', 'bad-id', {} as any);
      expect(result).toEqual(expect.objectContaining({ ok: false }));
    });
  });

  describe('deleteSavedSearch', () => {
    it('should delete a saved search belonging to the user', async () => {
      const userId = 'test-user-id';
      const id = 'search-1';
      const existing = { id, userId, name: 'Search', filters: {}, isDefault: false };

      mockSavedSearchRepository.findOne.mockResolvedValue(existing);
      mockSavedSearchRepository.delete.mockResolvedValue({ affected: 1 });

      await service.deleteSavedSearch(userId, id);

      expect(mockSavedSearchRepository.delete).toHaveBeenCalledWith({ id, userId });
    });
  });
});
