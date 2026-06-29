import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import { StorageAccessService } from './storage-access.service';

@Injectable()
export class StorageService {
  constructor(private readonly storageAccess: StorageAccessService) {}

  async saveFile(
    file: { originalname: string; buffer: Buffer; mimetype: string },
    ownerId?: string,
  ): Promise<string> {
    try {
      const fileExtension = extname(file.originalname);
      const key = `files/${randomUUID()}${fileExtension}`;

      const stored = await this.storageAccess.getProvider().save(file.buffer, {
        key,
        contentType: file.mimetype,
        ownerId,
        visibility: 'private',
      });

      if (ownerId) {
        this.storageAccess.registerAccessRule({
          key,
          ownerId,
          visibility: 'private',
        });
      }

      return stored.path;
    } catch {
      throw new InternalServerErrorException('Failed to save file');
    }
  }

  async getSignedDownloadUrl(
    key: string,
    requesterId: string,
    isAdmin = false,
  ): Promise<string> {
    return this.storageAccess.getSignedDownloadUrl(key, requesterId, isAdmin);
  }

  async getSignedUploadUrl(
    originalName: string,
    ownerId: string,
    contentType: string,
  ) {
    return this.storageAccess.getSignedUploadUrl(
      originalName,
      ownerId,
      contentType,
    );
  }

  async deleteFile(key: string): Promise<void> {
    await this.storageAccess.getProvider().delete(key);
  }
}
