import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { JobQueueService } from './job-queue.service';
import { QUEUE_NAMES } from './job-queue.constants';

const createMockQueue = () => ({
  add: jest.fn().mockResolvedValue({ id: 'job-1', data: {} }),
  getWaitingCount: jest.fn().mockResolvedValue(5),
  getActiveCount: jest.fn().mockResolvedValue(2),
  getCompletedCount: jest.fn().mockResolvedValue(100),
  getFailedCount: jest.fn().mockResolvedValue(3),
  getDelayedCount: jest.fn().mockResolvedValue(1),
  getFailed: jest.fn().mockResolvedValue([]),
  getJob: jest.fn().mockResolvedValue(null),
});

describe('JobQueueService', () => {
  let service: JobQueueService;
  let notificationQueue: ReturnType<typeof createMockQueue>;
  let emailQueue: ReturnType<typeof createMockQueue>;
  let blockchainQueue: ReturnType<typeof createMockQueue>;
  let reportQueue: ReturnType<typeof createMockQueue>;
  let disputeEvidenceQueue: ReturnType<typeof createMockQueue>;
  let avatarQueue: ReturnType<typeof createMockQueue>;
  let auditLogExportQueue: ReturnType<typeof createMockQueue>;

  beforeEach(async () => {
    notificationQueue = createMockQueue();
    emailQueue = createMockQueue();
    blockchainQueue = createMockQueue();
    reportQueue = createMockQueue();
    disputeEvidenceQueue = createMockQueue();
    avatarQueue = createMockQueue();
    auditLogExportQueue = createMockQueue();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobQueueService,
        {
          provide: getQueueToken(QUEUE_NAMES.NOTIFICATIONS),
          useValue: notificationQueue,
        },
        { provide: getQueueToken(QUEUE_NAMES.EMAIL), useValue: emailQueue },
        {
          provide: getQueueToken(QUEUE_NAMES.BLOCKCHAIN),
          useValue: blockchainQueue,
        },
        { provide: getQueueToken(QUEUE_NAMES.REPORTS), useValue: reportQueue },
        {
          provide: getQueueToken(QUEUE_NAMES.DISPUTE_EVIDENCE),
          useValue: disputeEvidenceQueue,
        },
        { provide: getQueueToken(QUEUE_NAMES.AVATAR), useValue: avatarQueue },
        {
          provide: getQueueToken(QUEUE_NAMES.AUDIT_LOG_EXPORT),
          useValue: auditLogExportQueue,
        },
      ],
    }).compile();

    service = module.get<JobQueueService>(JobQueueService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addNotificationJob', () => {
    it('should add a job to the notification queue', async () => {
      const data = {
        userId: 'user-1',
        type: 'sweep_completed',
        title: 'Sweep Done',
        message: 'Swept 100 XLM',
      };

      const result = await service.addNotificationJob(data);

      expect(notificationQueue.add).toHaveBeenCalledWith(
        'send-notification',
        data,
        undefined,
      );
      expect(result.id).toBe('job-1');
    });
  });

  describe('addEmailJob', () => {
    it('should add a job to the email queue', async () => {
      const data = {
        to: 'user@test.com',
        subject: 'Welcome',
        template: 'welcome',
        context: { name: 'Alice' },
      };

      const result = await service.addEmailJob(data);

      expect(emailQueue.add).toHaveBeenCalledWith(
        'send-email',
        data,
        undefined,
      );
      expect(result.id).toBe('job-1');
    });
  });

  describe('addBlockchainJob', () => {
    it('should add a job with deduplication key', async () => {
      const data = {
        eventId: 'evt-123',
        contractId: 'CABC123',
        eventType: 'deposit',
        rawEvent: { ledger: 100 },
      };

      await service.addBlockchainJob(data);

      expect(blockchainQueue.add).toHaveBeenCalledWith(
        'process-blockchain-event',
        data,
        { jobId: 'blockchain-evt-123' },
      );
    });
  });

  describe('addReportJob', () => {
    it('should add a report generation job', async () => {
      const data = {
        reportType: 'monthly-summary',
        userId: 'user-1',
        params: { month: 6, year: 2026 },
      };

      await service.addReportJob(data);

      expect(reportQueue.add).toHaveBeenCalledWith(
        'generate-report',
        data,
        undefined,
      );
    });
  });

  describe('addAvatarProcessingJob', () => {
    it('should add an avatar processing job with deduplication key', async () => {
      const data = {
        uploadId: 'upload-1',
        userId: 'user-1',
        storagePath: 'avatars/user-1/raw.png',
        mimeType: 'image/png',
        originalFilename: 'avatar.png',
      };

      await service.addAvatarProcessingJob(data);

      expect(avatarQueue.add).toHaveBeenCalledWith(
        'process-avatar',
        data,
        expect.objectContaining({
          jobId: 'avatar-upload-1',
          attempts: 3,
        }),
      );
    });
  });

  describe('addAuditLogExportJob', () => {
    it('should add an audit log export job', async () => {
      const data = {
        filters: { actor: 'admin-1' },
        format: 'csv' as const,
        requestedBy: 'admin-1',
      };

      await service.addAuditLogExportJob(data);

      expect(auditLogExportQueue.add).toHaveBeenCalledWith(
        'export-audit-logs',
        data,
        expect.objectContaining({
          attempts: 3,
        }),
      );
    });
  });

  describe('getQueueStatus', () => {
    it('should return status for a valid queue', async () => {
      const status = await service.getQueueStatus(QUEUE_NAMES.NOTIFICATIONS);

      expect(status).toEqual({
        queueName: QUEUE_NAMES.NOTIFICATIONS,
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 3,
        delayed: 1,
        dlqSize: 3,
      });
    });

    it('should return null for an unknown queue', async () => {
      const status = await service.getQueueStatus('nonexistent');
      expect(status).toBeNull();
    });
  });

  describe('getAllQueuesStatus', () => {
    it('should return statuses for all queues', async () => {
      const statuses = await service.getAllQueuesStatus();
      expect(statuses).toHaveLength(7);
    });
  });

  describe('retryFailedJob', () => {
    it('should return null for unknown queue', async () => {
      const result = await service.retryFailedJob('nonexistent', 'job-1');
      expect(result).toBeNull();
    });

    it('should return null for unknown job', async () => {
      const result = await service.retryFailedJob(
        QUEUE_NAMES.NOTIFICATIONS,
        'unknown-job',
      );
      expect(result).toBeNull();
    });

    it('should retry a failed job', async () => {
      const mockJob = { retry: jest.fn().mockResolvedValue(undefined) };
      notificationQueue.getJob.mockResolvedValue(mockJob);

      const result = await service.retryFailedJob(
        QUEUE_NAMES.NOTIFICATIONS,
        'job-1',
      );

      expect(result).toEqual({ jobId: 'job-1', status: 'retried' });
      expect(mockJob.retry).toHaveBeenCalled();
    });
  });
});
