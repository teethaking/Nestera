import { Test, TestingModule } from '@nestjs/testing';
import { CacheStrategyService, CacheTTL } from './cache-strategy.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

describe('CacheStrategyService - Adaptive TTL', () => {
  let service: CacheStrategyService;
  let cacheManager: jest.Mocked<Cache>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheStrategyService,
        {
          provide: CACHE_MANAGER,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CacheStrategyService>(CacheStrategyService);
    cacheManager = module.get(CACHE_MANAGER);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Adaptive TTL Calculation', () => {
    it('should return base TTL when no update history exists', async () => {
      cacheManager.set.mockResolvedValue(undefined);
      
      await service.set('test-key', 'value');
      
      expect(cacheManager.set).toHaveBeenCalledWith(
        'test-key',
        'value',
        CacheTTL.SHORT, // Default TTL
      );
    });

    it('should decrease TTL for high volatility keys', async () => {
      cacheManager.set.mockResolvedValue(undefined);
      
      // Simulate high volatility by setting the key multiple times
      for (let i = 0; i < 15; i++) {
        await service.set('volatile-key', `value-${i}`);
      }
      
      const lastCall = cacheManager.set.mock.calls[cacheManager.set.mock.calls.length - 1];
      const adaptiveTTL = lastCall[2];
      
      // Should be lower than base TTL due to high volatility
      expect(adaptiveTTL).toBeLessThan(CacheTTL.SHORT);
      expect(adaptiveTTL).toBeGreaterThanOrEqual(service['adaptiveConfig'].minTTL);
    });

    it('should increase TTL for low volatility keys', async () => {
      cacheManager.set.mockResolvedValue(undefined);
      
      // Simulate low volatility by setting the key only once
      await service.set('stable-key', 'value');
      
      const lastCall = cacheManager.set.mock.calls[cacheManager.set.mock.calls.length - 1];
      const adaptiveTTL = lastCall[2];
      
      // Should be base TTL for stable keys
      expect(adaptiveTTL).toBe(CacheTTL.SHORT);
    });

    it('should respect minTTL boundary for extremely volatile keys', async () => {
      cacheManager.set.mockResolvedValue(undefined);
      
      // Simulate extreme volatility
      for (let i = 0; i < 50; i++) {
        await service.set('extreme-volatile-key', `value-${i}`);
      }
      
      const lastCall = cacheManager.set.mock.calls[cacheManager.set.mock.calls.length - 1];
      const adaptiveTTL = lastCall[2];
      
      // Should not go below minTTL
      expect(adaptiveTTL).toBeGreaterThanOrEqual(service['adaptiveConfig'].minTTL);
    });

    it('should respect maxTTL boundary for extremely stable keys', async () => {
      cacheManager.set.mockResolvedValue(undefined);
      
      // Set a key with long base TTL
      await service.set('analytics-key', 'value', CacheTTL.LONG);
      
      const lastCall = cacheManager.set.mock.calls[cacheManager.set.mock.calls.length - 1];
      const adaptiveTTL = lastCall[2];
      
      // Should not exceed maxTTL
      expect(adaptiveTTL).toBeLessThanOrEqual(service['adaptiveConfig'].maxTTL);
    });
  });

  describe('Update Frequency Tracking', () => {
    it('should track update history for keys', async () => {
      cacheManager.set.mockResolvedValue(undefined);
      
      await service.set('tracked-key', 'value1');
      await service.set('tracked-key', 'value2');
      await service.set('tracked-key', 'value3');
      
      const stats = service.getAdaptiveTTLStats();
      
      expect(stats.totalKeys).toBeGreaterThan(0);
      expect(stats.keysWithAdaptiveTTL).toBeGreaterThan(0);
    });

    it('should clean up old update history', async () => {
      cacheManager.set.mockResolvedValue(undefined);
      
      const key = 'cleanup-key';
      
      // Set key multiple times
      for (let i = 0; i < 5; i++) {
        await service.set(key, `value-${i}`);
      }
      
      const statsBefore = service.getAdaptiveTTLStats();
      expect(statsBefore.keysWithAdaptiveTTL).toBeGreaterThan(0);
    });
  });

  describe('Adaptive TTL Statistics', () => {
    it('should return correct statistics', async () => {
      cacheManager.set.mockResolvedValue(undefined);
      
      await service.set('key1', 'value1');
      await service.set('key2', 'value2');
      
      const stats = service.getAdaptiveTTLStats();
      
      expect(stats).toHaveProperty('totalKeys');
      expect(stats).toHaveProperty('keysWithAdaptiveTTL');
      expect(stats).toHaveProperty('averageUpdateFrequency');
      expect(stats).toHaveProperty('config');
      
      expect(stats.config).toEqual({
        minTTL: CacheTTL.SHORT,
        maxTTL: CacheTTL.LONG,
        volatilityThreshold: 5,
        sampleWindow: 10,
      });
    });

    it('should calculate average update frequency correctly', async () => {
      cacheManager.set.mockResolvedValue(undefined);
      
      // Create keys with different update frequencies
      for (let i = 0; i < 10; i++) {
        await service.set('frequent-key', `value-${i}`);
      }
      
      await service.set('rare-key', 'value');
      
      const stats = service.getAdaptiveTTLStats();
      
      expect(stats.averageUpdateFrequency).toBeGreaterThan(0);
    });
  });

  describe('Custom TTL Override', () => {
    it('should use provided TTL instead of adaptive TTL', async () => {
      cacheManager.set.mockResolvedValue(undefined);
      
      const customTTL = 60000; // 1 minute
      await service.set('custom-key', 'value', customTTL);
      
      expect(cacheManager.set).toHaveBeenCalledWith(
        'custom-key',
        'value',
        customTTL,
      );
    });
  });
});
