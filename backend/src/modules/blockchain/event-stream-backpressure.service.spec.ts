import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EventStreamBackpressureService } from './event-stream-backpressure.service';
import { JobQueueService } from '../job-queue/job-queue.service';

describe('EventStreamBackpressureService', () => {
  let service: EventStreamBackpressureService;
  let jobQueueService: { getQueueStatus: jest.Mock };

  beforeEach(async () => {
    jobQueueService = {
      getQueueStatus: jest.fn().mockResolvedValue({
        waiting: 500,
        active: 600,
        completed: 0,
        failed: 0,
        delayed: 0,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventStreamBackpressureService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, number> = {
                'eventStream.maxQueueDepth': 1000,
                'eventStream.maxIngestionRatePerSecond': 100,
                'eventStream.workerConcurrency': 5,
              };
              return config[key];
            }),
          },
        },
        { provide: JobQueueService, useValue: jobQueueService },
      ],
    }).compile();

    service = module.get(EventStreamBackpressureService);
  });

  it('pauses ingestion when queue depth exceeds threshold', async () => {
    const shouldPause = await service.shouldPauseIngestion();
    expect(shouldPause).toBe(true);
    expect(service.isPaused()).toBe(true);
  });

  it('reports backpressure status with queue metrics', async () => {
    const status = await service.getStatus();
    expect(status.queueDepth).toBe(1100);
    expect(status.maxQueueDepth).toBe(1000);
    expect(status.workerConcurrency).toBe(5);
  });

  it('enforces ingestion rate limits', () => {
    expect(service.canIngestEvents(50)).toBe(true);
    expect(service.canIngestEvents(60)).toBe(false);
  });

  it('demonstrates stability under sustained load', async () => {
    jobQueueService.getQueueStatus.mockResolvedValue({
      waiting: 100,
      active: 50,
      completed: 0,
      failed: 0,
      delayed: 0,
    });

    const shouldPause = await service.shouldPauseIngestion();
    expect(shouldPause).toBe(false);

    let ingested = 0;
    for (let i = 0; i < 200; i++) {
      if (service.canIngestEvents(1)) ingested++;
    }
    expect(ingested).toBeLessThanOrEqual(100);
  });
});
