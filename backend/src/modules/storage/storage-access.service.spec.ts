import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException } from '@nestjs/common';
import { StorageAccessService } from './storage-access.service';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { S3StorageProvider } from './providers/s3-storage.provider';

describe('StorageAccessService', () => {
  let service: StorageAccessService;
  let localProvider: LocalStorageProvider;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageAccessService,
        LocalStorageProvider,
        S3StorageProvider,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, string | number> = {
                'upload.provider': 'local',
                'upload.localDir': '/tmp/nestera-test-uploads',
                'upload.signedUrlTtlSeconds': 3600,
                'jwt.secret': 'test-secret',
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get(StorageAccessService);
    localProvider = module.get(LocalStorageProvider);
  });

  it('registers and enforces owner-based access rules', async () => {
    service.registerAccessRule({
      key: 'files/test.pdf',
      ownerId: 'user-1',
      visibility: 'private',
    });

    await expect(
      service.assertAccess('files/test.pdf', 'user-2', 'read'),
    ).rejects.toThrow(ForbiddenException);

    await expect(
      service.assertAccess('files/test.pdf', 'user-1', 'read'),
    ).resolves.toBeUndefined();
  });

  it('generates verifiable local signed URLs', async () => {
    const url = await service.getSignedDownloadUrl('files/test.pdf', 'user-1');
    expect(url).toContain('/api/storage/signed?');
    expect(url).toContain('sig=');
  });

  it('uses local provider when configured', () => {
    expect(service.getProvider().name).toBe('local');
  });
});
