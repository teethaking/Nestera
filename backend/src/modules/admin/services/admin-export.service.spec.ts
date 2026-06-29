import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bull';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AdminExportService } from './admin-export.service';
import {
  AdminExportJob,
  AdminExportDataType,
  AdminExportStatus,
} from '../entities/admin-export-job.entity';
import { Transaction } from '../../transactions/entities/transaction.entity';
import { Dispute } from '../../disputes/entities/dispute.entity';
import { DataScopeService } from '../../../common/services/data-scope.service';
import { Role } from '../../../common/enums/role.enum';
import { ADMIN_EXPORT_QUEUE } from '../admin-export.constants';
import {
  TxType,
  TxStatus,
} from '../../transactions/entities/transaction.entity';
import {
  DisputeStatus,
  DisputePriority,
} from '../../disputes/entities/dispute.entity';

import { AdminTransactionFilterDto } from '../dto/admin-transaction-filter.dto';

describe('AdminExportService', () => {
  let service: AdminExportService;

  const baseTransactionFilter = {
    page: 1,
    limit: 10,
    get pageSize() {
      return 10;
    },
    get skip() {
      return 0;
    },
    get shouldIncludeTotal() {
      return false;
    },
  } as AdminTransactionFilterDto;

  const mockExportJobRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const mockTxRepo = {
    createQueryBuilder: jest.fn(),
  };

  const mockDisputeRepo = {
    createQueryBuilder: jest.fn(),
  };

  const mockExportQueue = {
    add: jest.fn(),
  };

  const mockDataScopeService = {
    getMaxTimeRange: jest.fn(),
    applyDateRangeFilter: jest.fn(),
    filterSensitiveFields: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockDataScopeService.getMaxTimeRange.mockImplementation((role: Role) => {
      if (role === Role.ANALYST) return 90;
      if (role === Role.SUPER_ADMIN) return 365;
      return 30;
    });
    mockDataScopeService.applyDateRangeFilter.mockImplementation(
      (_role: Role, requested: number) => requested,
    );
    mockDataScopeService.filterSensitiveFields.mockImplementation(
      (role: Role, data: Record<string, unknown>, fields: string[]) => {
        if (role === Role.SUPER_ADMIN) return data;
        const filtered = { ...data };
        for (const field of fields) {
          delete filtered[field];
        }
        return filtered;
      },
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminExportService,
        {
          provide: getRepositoryToken(AdminExportJob),
          useValue: mockExportJobRepository,
        },
        {
          provide: getRepositoryToken(Transaction),
          useValue: mockTxRepo,
        },
        {
          provide: getRepositoryToken(Dispute),
          useValue: mockDisputeRepo,
        },
        {
          provide: getQueueToken(ADMIN_EXPORT_QUEUE),
          useValue: mockExportQueue,
        },
        {
          provide: DataScopeService,
          useValue: mockDataScopeService,
        },
      ],
    }).compile();

    service = module.get<AdminExportService>(AdminExportService);
  });

  describe('applyScopedTransactionFilters', () => {
    it('caps date range for analyst role', () => {
      mockDataScopeService.applyDateRangeFilter.mockReturnValue(30);

      const end = new Date('2026-06-01T00:00:00.000Z');
      const start = new Date('2026-01-01T00:00:00.000Z');

      const result = service.applyScopedTransactionFilters(Role.ANALYST, {
        ...baseTransactionFilter,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      } as AdminTransactionFilterDto);

      expect(mockDataScopeService.applyDateRangeFilter).toHaveBeenCalled();
      expect(new Date(result.endDate!).getTime()).toBe(end.getTime());
      expect(new Date(result.startDate!).getTime()).toBeGreaterThan(
        start.getTime(),
      );
    });

    it('throws when dates are invalid', () => {
      expect(() =>
        service.applyScopedTransactionFilters(Role.ADMIN, {
          ...baseTransactionFilter,
          startDate: 'invalid',
          endDate: '2026-06-01T00:00:00.000Z',
        } as AdminTransactionFilterDto),
      ).toThrow(BadRequestException);
    });
  });

  describe('filterTransactionRow', () => {
    it('removes sensitive fields for admin role', () => {
      const tx = {
        id: 'tx-1',
        userId: 'user-1',
        type: TxType.DEPOSIT,
        status: TxStatus.COMPLETED,
        amount: '100',
        txHash: 'hash',
        publicKey: 'pk',
        poolId: 'pool',
        eventId: 'event',
        ledgerSequence: '1',
        metadata: { foo: 'bar' },
        flagged: false,
        category: null,
        tags: [],
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
      } as unknown as Transaction;

      const row = service.filterTransactionRow(Role.ADMIN, tx);

      expect(row.id).toBe('tx-1');
      expect(row.txHash).toBeUndefined();
      expect(row.publicKey).toBeUndefined();
      expect(row.metadata).toBeUndefined();
    });

    it('keeps sensitive fields for super admin role', () => {
      const tx = {
        id: 'tx-1',
        userId: 'user-1',
        type: TxType.DEPOSIT,
        status: TxStatus.COMPLETED,
        amount: '100',
        txHash: 'hash',
        publicKey: 'pk',
        poolId: 'pool',
        eventId: 'event',
        ledgerSequence: '1',
        metadata: { foo: 'bar' },
        flagged: false,
        category: null,
        tags: [],
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
      } as unknown as Transaction;

      const row = service.filterTransactionRow(Role.SUPER_ADMIN, tx);

      expect(row.txHash).toBe('hash');
      expect(row.publicKey).toBe('pk');
    });
  });

  describe('filterDisputeRow', () => {
    it('removes sensitive dispute fields for analyst role', () => {
      const dispute = {
        id: 'd-1',
        claimId: 'claim-1',
        disputedBy: 'user-1',
        reason: 'test',
        status: DisputeStatus.OPEN,
        priority: DisputePriority.MEDIUM,
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
        updatedAt: new Date('2026-06-01T00:00:00.000Z'),
        evidence: [{ id: 'e1' }],
        resolution: 'resolved',
      } as unknown as Dispute;

      const row = service.filterDisputeRow(Role.ANALYST, dispute);

      expect(row.id).toBe('d-1');
      expect(row.disputedBy).toBeUndefined();
      expect(row.evidence).toBeUndefined();
      expect(row.resolution).toBeUndefined();
    });
  });

  describe('requestTransactionsExportJob', () => {
    it('queues export job and returns pending status', async () => {
      const savedJob = {
        id: 'job-1',
        userId: 'admin-1',
        dataType: AdminExportDataType.TRANSACTIONS,
        status: AdminExportStatus.PENDING,
        createdAt: new Date(),
        completedAt: null,
        expiresAt: new Date(),
      };

      mockExportJobRepository.create.mockReturnValue(savedJob);
      mockExportJobRepository.save.mockResolvedValue(savedJob);
      mockExportQueue.add.mockResolvedValue({ id: 'job-1' });
      mockExportJobRepository.update.mockResolvedValue(undefined);

      const result = await service.requestTransactionsExportJob(
        'admin-1',
        Role.ADMIN,
        baseTransactionFilter,
      );

      expect(mockExportQueue.add).toHaveBeenCalled();
      expect(result.requestId).toBe('job-1');
      expect(result.status).toBe(AdminExportStatus.PENDING);
      expect(result.dataType).toBe(AdminExportDataType.TRANSACTIONS);
    });
  });

  describe('getExportJobStatus', () => {
    it('throws when user does not own the job', async () => {
      mockExportJobRepository.findOne.mockResolvedValue({
        id: 'job-1',
        userId: 'other-user',
        status: AdminExportStatus.PENDING,
        dataType: AdminExportDataType.TRANSACTIONS,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      });

      await expect(
        service.getExportJobStatus('admin-1', 'job-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
