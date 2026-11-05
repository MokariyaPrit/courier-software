import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as fs from 'fs';
import * as path from 'path';
import { UPLOADS_ROOT, ensureUploadsDirs } from '../common/uploads';

export type StoredObject = {
  key: string;
  /** Public URL if R2_PUBLIC_BASE_URL set, else empty (use signed URL). */
  url: string;
};

@Injectable()
export class R2StorageService {
  private readonly logger = new Logger(R2StorageService.name);
  private readonly client: S3Client | null;
  private readonly bucket: string;
  private readonly publicBase: string;
  private readonly localFallback: boolean;

  constructor(private readonly config: ConfigService) {
    const accountId = (config.get<string>('R2_ACCOUNT_ID') || '').trim();
    const accessKeyId = (config.get<string>('R2_ACCESS_KEY_ID') || '').trim();
    const secretAccessKey = (
      config.get<string>('R2_SECRET_ACCESS_KEY') || ''
    ).trim();
    const bucket = (config.get<string>('R2_BUCKET') || '').trim();
    const endpoint =
      (config.get<string>('R2_ENDPOINT') || '').trim() ||
      (accountId
        ? `https://${accountId}.r2.cloudflarestorage.com`
        : '');

    this.bucket = bucket;
    this.publicBase = (config.get<string>('R2_PUBLIC_BASE_URL') || '')
      .trim()
      .replace(/\/$/, '');

    if (accountId && accessKeyId && secretAccessKey && bucket && endpoint) {
      this.client = new S3Client({
        region: 'auto',
        endpoint,
        credentials: { accessKeyId, secretAccessKey },
        forcePathStyle: true,
      });
      this.localFallback = false;
      this.logger.log(`R2 storage enabled (bucket=${bucket})`);
    } else {
      this.client = null;
      this.localFallback = true;
      ensureUploadsDirs();
      this.logger.warn(
        'R2 env incomplete — using local uploads/ fallback for Anjani files',
      );
    }
  }

  isR2Enabled() {
    return Boolean(this.client);
  }

  private publicUrlFor(key: string): string {
    if (!this.publicBase) return '';
    return `${this.publicBase}/${key.replace(/^\//, '')}`;
  }

  async putObject(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<StoredObject> {
    const normalized = key.replace(/^\/+/, '');

    if (this.client) {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: normalized,
          Body: body,
          ContentType: contentType,
        }),
      );
      return { key: normalized, url: this.publicUrlFor(normalized) };
    }

    const abs = path.join(UPLOADS_ROOT, normalized);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body);
    return { key: normalized, url: `/uploads/${normalized}` };
  }

  async getSignedDownloadUrl(
    key: string,
    expiresInSeconds = 3600,
  ): Promise<string> {
    const normalized = key.replace(/^\/+/, '');
    if (!normalized) return '';

    if (this.client) {
      if (this.publicBase) return this.publicUrlFor(normalized);
      return getSignedUrl(
        this.client,
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: normalized,
        }),
        { expiresIn: expiresInSeconds },
      );
    }

    return `/uploads/${normalized}`;
  }

  async deleteObject(key: string | null | undefined): Promise<void> {
    const normalized = (key || '').replace(/^\/+/, '');
    if (!normalized) return;

    if (this.client) {
      try {
        await this.client.send(
          new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: normalized,
          }),
        );
      } catch (err) {
        this.logger.warn(`R2 delete failed for ${normalized}: ${String(err)}`);
      }
      return;
    }

    const abs = path.join(UPLOADS_ROOT, normalized);
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  }
}
