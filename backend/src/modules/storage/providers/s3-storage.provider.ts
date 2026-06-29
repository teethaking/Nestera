import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import {
  StorageProvider,
  StoredFile,
} from './storage-provider.interface';

@Injectable()
export class S3StorageProvider implements StorageProvider {
  readonly name = 's3';
  private readonly s3: S3Client;
  private readonly bucket: string;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.get<string>('upload.s3Bucket') || '';
    this.s3 = new S3Client({
      region: this.configService.get<string>('upload.s3Region') ?? 'us-east-1',
      credentials: {
        accessKeyId:
          this.configService.get<string>('upload.awsAccessKeyId') || '',
        secretAccessKey:
          this.configService.get<string>('upload.awsSecretAccessKey') || '',
      },
    });
  }

  async save(
    buffer: Buffer,
    options: {
      key: string;
      contentType: string;
      ownerId?: string;
      visibility?: 'private' | 'public';
    },
  ): Promise<StoredFile> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: options.key,
        Body: buffer,
        ContentType: options.contentType,
        Metadata: options.ownerId ? { ownerId: options.ownerId } : undefined,
        ACL: options.visibility === 'public' ? 'public-read' : 'private',
      }),
    );

    return {
      key: options.key,
      path: `s3://${this.bucket}/${options.key}`,
      size: buffer.length,
      contentType: options.contentType,
    };
  }

  async delete(key: string): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.s3.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return true;
    } catch {
      return false;
    }
  }

  async getSignedUrl(
    key: string,
    options: {
      operation: 'read' | 'write';
      expiresInSeconds: number;
      ownerId?: string;
    },
  ): Promise<string> {
    const command =
      options.operation === 'read'
        ? new GetObjectCommand({ Bucket: this.bucket, Key: key })
        : new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Metadata: options.ownerId
              ? { ownerId: options.ownerId }
              : undefined,
          });

    return getSignedUrl(this.s3, command, {
      expiresIn: options.expiresInSeconds,
    });
  }

  static buildKey(originalName: string, prefix = 'files'): string {
    const ext = extname(originalName);
    return `${prefix}/${randomUUID()}${ext}`;
  }
}
