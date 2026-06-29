import { Test, TestingModule } from '@nestjs/testing';
import { AdminTransactionsController } from './admin-transactions.controller';
import { AdminTransactionsService } from './admin-transactions.service';
import { AdminExportService } from './services/admin-export.service';
import { AdminTransactionFilterDto } from './dto/admin-transaction-filter.dto';
import { PageDto } from '../../common/dto/page.dto';
import { Transaction } from '../transactions/entities/transaction.entity';

describe('AdminTransactionsController', () => {
  let controller: AdminTransactionsController;
  let service: AdminTransactionsService;

  const mockAdminTransactionsService = {
    findAll: jest.fn(),
  };

  const mockAdminExportService = {
    streamTransactionsCsv: jest.fn(),
    requestTransactionsExportJob: jest.fn(),
    getExportJobStatus: jest.fn(),
    getExportJobDownload: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminTransactionsController],
      providers: [
        {
          provide: AdminTransactionsService,
          useValue: mockAdminTransactionsService,
        },
        {
          provide: AdminExportService,
          useValue: mockAdminExportService,
        },
      ],
    }).compile();

    controller = module.get<AdminTransactionsController>(
      AdminTransactionsController,
    );
    service = module.get<AdminTransactionsService>(AdminTransactionsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('listTransactions', () => {
    it('should call adminTransactionsService.findAll with query parameters', async () => {
      const query = {
        page: 1,
        limit: 10,
      } as AdminTransactionFilterDto;

      const mockResult: PageDto<Transaction> = {
        items: [],
        meta: {
          page: 1,
          pageSize: 10,
          totalItemCount: 0,
          pageCount: 0,
          hasPreviousPage: false,
          hasNextPage: false,
          nextCursor: null,
        },
      };

      mockAdminTransactionsService.findAll.mockResolvedValue(mockResult);

      const result = await controller.listTransactions(query);

      expect(service.findAll).toHaveBeenCalledWith(query);
      expect(result).toEqual(mockResult);
    });

    it('should pass filter parameters to the service', async () => {
      const query = {
        page: 1,
        limit: 10,
        userId: 'test-user-id',
        flagged: true,
      } as AdminTransactionFilterDto;

      const mockResult: PageDto<Transaction> = {
        items: [],
        meta: {
          page: 1,
          pageSize: 10,
          totalItemCount: 0,
          pageCount: 0,
          hasPreviousPage: false,
          hasNextPage: false,
          nextCursor: null,
        },
      };

      mockAdminTransactionsService.findAll.mockResolvedValue(mockResult);

      await controller.listTransactions(query);

      expect(service.findAll).toHaveBeenCalledWith(query);
    });
  });
});
