import { Test, TestingModule } from '@nestjs/testing';
import { CacheInvalidationService } from './cache-invalidation.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CacheStrategyService } from '../../modules/cache/cache-strategy.service';

describe('CacheInvalidationService', () => {
  let service: CacheInvalidationService;
  let eventEmitter: EventEmitter2;
  let cacheStrategy: CacheStrategyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheInvalidationService,
        {
          provide: EventEmitter2,
          useValue: {
            on: jest.fn(),
            emit: jest.fn(),
          },
        },
        {
          provide: CacheStrategyService,
          useValue: {
            del: jest.fn(),
            invalidateByTag: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<CacheInvalidationService>(CacheInvalidationService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
    cacheStrategy = module.get<CacheStrategyService>(CacheStrategyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should emit cache invalidation event for key', async () => {
    await service.invalidateKey('test-key');
    expect(eventEmitter.emit).toHaveBeenCalled();
  });

  it('should emit cache invalidation event for tag', async () => {
    await service.invalidateTag('user');
    expect(eventEmitter.emit).toHaveBeenCalled();
  });

  it('should emit cache invalidation event for pattern', async () => {
    await service.invalidatePattern('user:*');
    expect(eventEmitter.emit).toHaveBeenCalled();
  });
});
