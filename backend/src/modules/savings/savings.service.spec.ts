import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SavingsService } from './savings.service';
import { PredictiveEvaluatorService } from './services/predictive-evaluator.service';
import { SavingsProduct } from './entities/savings-product.entity';
import { UserSubscription } from './entities/user-subscription.entity';
import { SavingsGoal, SavingsGoalStatus } from './entities/savings-goal.entity';
import { User } from '../user/entities/user.entity';
import { SavingsService as BlockchainSavingsService } from '../blockchain/savings.service';

describe('SavingsService', () => {
  let service: SavingsService;
  let productRepository: {
    create: jest.Mock;
    save: jest.Mock;
    findOneBy: jest.Mock;
  };
  let subscriptionRepository: { find: jest.Mock };
  let goalRepository: { find: jest.Mock };
  let userRepository: { findOne: jest.Mock };
  let blockchainSavingsService: {
    getUserSavingsBalance: jest.Mock;
    getUserVaultBalance: jest.Mock;
  };
  let cacheManager: { del: jest.Mock };

  beforeEach(async () => {
    productRepository = {
      create: jest.fn((value) => value),
      save: jest.fn(),
      findOneBy: jest.fn(),
    };

    subscriptionRepository = {
      find: jest.fn(),
    };

    goalRepository = {
      find: jest.fn(),
    };

    userRepository = {
      findOne: jest.fn(),
    };

    blockchainSavingsService = {
      getUserSavingsBalance: jest.fn(),
      getUserVaultBalance: jest.fn(),
    };

    cacheManager = {
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SavingsService,
        {
          provide: getRepositoryToken(SavingsProduct),
          useValue: productRepository,
        },
        {
          provide: getRepositoryToken(UserSubscription),
          useValue: subscriptionRepository,
        },
        {
          provide: getRepositoryToken(SavingsGoal),
          useValue: goalRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: userRepository,
        },
        {
          provide: BlockchainSavingsService,
          useValue: blockchainSavingsService,
        },
        {
          provide: PredictiveEvaluatorService,
          useValue: {
            calculateProjectedBalance: jest.fn((balance) => balance),
            isOffTrack: jest.fn(() => false),
            calculateProjectionGap: jest.fn(() => 0),
            calculateDaysRemaining: jest.fn(() => 365),
            calculateRequiredMonthlyContribution: jest.fn(() => 0),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) =>
              key === 'stellar.contractId'
                ? 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHK3M'
                : undefined,
            ),
          },
        },
        {
          provide: CACHE_MANAGER,
          useValue: cacheManager,
        },
      ],
    }).compile();

    service = module.get<SavingsService>(SavingsService);
  });

  it('returns goals enriched with percentageComplete from live vault balances', async () => {
    goalRepository.find.mockResolvedValue([
      {
        id: 'goal-1',
        userId: 'user-1',
        goalName: 'Emergency Fund',
        targetAmount: 100,
        targetDate: new Date('2026-12-31'),
        status: SavingsGoalStatus.IN_PROGRESS,
        metadata: null,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-02'),
      },
    ]);
    userRepository.findOne.mockResolvedValue({
      id: 'user-1',
      publicKey: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    });
    subscriptionRepository.find.mockResolvedValue([]);
    blockchainSavingsService.getUserSavingsBalance.mockResolvedValue({
      flexible: 24_000_000,
      locked: 50_000_000,
      total: 74_000_000,
    });

    await expect(service.findMyGoals('user-1')).resolves.toEqual([
      expect.objectContaining({
        id: 'goal-1',
        goalName: 'Emergency Fund',
        targetAmount: 100,
        currentBalance: 7.4,
        percentageComplete: 7,
        projectedBalance: 7.4,
        isOffTrack: false,
        projectionGap: 0,
        appliedYieldRate: 0,
      }),
    ]);
  });

  it('returns 0 progress when the user has no linked wallet', async () => {
    goalRepository.find.mockResolvedValue([
      {
        id: 'goal-1',
        userId: 'user-1',
        goalName: 'Vacation',
        targetAmount: 10,
        targetDate: new Date('2026-12-31'),
        status: SavingsGoalStatus.IN_PROGRESS,
        metadata: null,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-02'),
      },
    ]);
    userRepository.findOne.mockResolvedValue({
      id: 'user-1',
      publicKey: null,
    });
    subscriptionRepository.find.mockResolvedValue([]);

    await expect(service.findMyGoals('user-1')).resolves.toEqual([
      expect.objectContaining({
        currentBalance: 0,
        percentageComplete: 0,
        projectedBalance: 0,
        isOffTrack: false,
        projectionGap: 0,
        appliedYieldRate: 0,
      }),
    ]);
    expect(
      blockchainSavingsService.getUserSavingsBalance,
    ).not.toHaveBeenCalled();
  });

  it('caps progress at 100 percent', async () => {
    goalRepository.find.mockResolvedValue([
      {
        id: 'goal-1',
        userId: 'user-1',
        goalName: 'New Laptop',
        targetAmount: 5,
        targetDate: new Date('2026-12-31'),
        status: SavingsGoalStatus.COMPLETED,
        metadata: null,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-02'),
      },
    ]);
    userRepository.findOne.mockResolvedValue({
      id: 'user-1',
      publicKey: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    });
    subscriptionRepository.find.mockResolvedValue([]);
    blockchainSavingsService.getUserSavingsBalance.mockResolvedValue({
      flexible: 40_000_000,
      locked: 20_000_000,
      total: 60_000_000,
    });

    await expect(service.findMyGoals('user-1')).resolves.toEqual([
      expect.objectContaining({
        currentBalance: 6,
        percentageComplete: 100,
        projectedBalance: 6,
        isOffTrack: false,
        projectionGap: 0,
        appliedYieldRate: 0,
      }),
    ]);
  });

  it('returns subscriptions enriched with live RPC balances', async () => {
    subscriptionRepository.find.mockResolvedValue([
      {
        id: 'sub-1',
        userId: 'user-1',
        productId: 'product-1',
        amount: 12.5,
        createdAt: new Date('2026-01-01'),
      },
    ]);
    userRepository.findOne.mockResolvedValue({
      id: 'user-1',
      publicKey: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    });
    blockchainSavingsService.getUserVaultBalance.mockResolvedValue(25_000_000);

    await expect(service.findMySubscriptions('user-1')).resolves.toEqual([
      expect.objectContaining({
        id: 'sub-1',
        indexedAmount: 12.5,
        liveBalance: 2.5,
        liveBalanceStroops: 25_000_000,
        balanceSource: 'rpc',
        vaultContractId:
          'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHK3M',
      }),
    ]);
    expect(blockchainSavingsService.getUserVaultBalance).toHaveBeenCalledWith(
      'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHK3M',
      'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    );
  });

  it('falls back to cached subscription amounts when wallet is missing', async () => {
    subscriptionRepository.find.mockResolvedValue([
      {
        id: 'sub-1',
        userId: 'user-1',
        productId: 'product-1',
        amount: 8.75,
        createdAt: new Date('2026-01-01'),
      },
    ]);
    userRepository.findOne.mockResolvedValue({
      id: 'user-1',
      publicKey: null,
    });

    await expect(service.findMySubscriptions('user-1')).resolves.toEqual([
      expect.objectContaining({
        indexedAmount: 8.75,
        liveBalance: 8.75,
        balanceSource: 'cache',
        vaultContractId: null,
      }),
    ]);
    expect(blockchainSavingsService.getUserVaultBalance).not.toHaveBeenCalled();
  });

  it('invalidates the pools cache after saving a product', async () => {
    productRepository.save.mockResolvedValue({
      id: 'product-1',
      name: 'Flexible Plan',
    });

    await expect(
      service.createProduct({
        name: 'Flexible Plan',
        type: 'FLEXIBLE' as SavingsProduct['type'],
        interestRate: 5,
        minAmount: 10,
        maxAmount: 100,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        id: 'product-1',
      }),
    );

    expect(cacheManager.del).toHaveBeenCalledWith('pools_all');
  });
});
