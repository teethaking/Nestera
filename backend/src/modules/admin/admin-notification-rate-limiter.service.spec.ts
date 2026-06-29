import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AdminNotificationRateLimiterService } from './admin-notification-rate-limiter.service';

describe('AdminNotificationRateLimiterService', () => {
  let service: AdminNotificationRateLimiterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminNotificationRateLimiterService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, number> = {
                'adminNotifications.maxPerMinute': 10,
                'adminNotifications.maxPerHour': 100,
                'adminNotifications.dedupWindowMs': 300_000,
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get(AdminNotificationRateLimiterService);
  });

  it('blocks duplicate notifications within dedup window', () => {
    expect(service.isDuplicate('Alert', 'System down', 'all')).toBe(false);
    expect(service.isDuplicate('Alert', 'System down', 'all')).toBe(true);
  });

  it('enforces per-minute rate limits', () => {
    const result = service.checkRateLimit('IN_APP', 11);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('per minute');
  });

  it('validates schedule config rejects past dates', () => {
    const result = service.validateScheduleConfig(
      new Date(Date.now() - 60_000).toISOString(),
    );
    expect(result.valid).toBe(false);
  });

  it('validates broadcast config rejects empty title', () => {
    const result = service.validateBroadcastConfig('', 'message');
    expect(result.valid).toBe(false);
  });
});
