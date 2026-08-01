import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { Readable } from 'node:stream';

interface R2Config {
  bucket: string;
  client: S3Client;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly localRoot = resolve(process.cwd(), 'output');
  private readonly r2?: R2Config;

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {
    const accountId = this.config.get<string>('R2_ACCOUNT_ID');
    const accessKeyId = this.config.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('R2_SECRET_ACCESS_KEY');
    const bucket = this.config.get<string>('R2_BUCKET');

    if (accountId && accessKeyId && secretAccessKey && bucket) {
      this.r2 = {
        bucket,
        client: new S3Client({
          region: 'auto',
          endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
          credentials: { accessKeyId, secretAccessKey },
        }),
      };
      this.logger.log(`Using Cloudflare R2 bucket "${bucket}"`);
    } else {
      this.logger.log(`R2 is not fully configured; using local storage at ${this.localRoot}`);
    }
  }

  async putInput(
    generationId: string,
    originalName: string,
    body: Buffer,
    contentType: string,
  ): Promise<string> {
    const safeExtension = extname(originalName).toLowerCase() || this.extensionForMime(contentType);
    const digest = createHash('sha256').update(body).digest('hex').slice(0, 12);
    const key = `inputs/${generationId}/source-${digest}${safeExtension}`;
    await this.put(key, body, contentType);
    return key;
  }

  async putOutput(
    outputPrefix: string,
    fileName: string,
    body: Buffer,
    contentType: string,
  ): Promise<string> {
    const key = `${outputPrefix}/${basename(fileName)}`;
    await this.put(key, body, contentType);
    return key;
  }

  async get(key: string): Promise<Buffer> {
    if (!this.r2) {
      return readFile(join(this.localRoot, key));
    }

    const response = await this.r2.client.send(
      new GetObjectCommand({ Bucket: this.r2.bucket, Key: key }),
    );
    if (!response.Body) {
      throw new Error(`Storage object "${key}" returned an empty body`);
    }

    return this.streamToBuffer(response.Body as Readable);
  }

  localPathForKey(key: string): string | undefined {
    return this.r2 ? undefined : join(this.localRoot, key);
  }

  publicUrl(key: string): string | undefined {
    const baseUrl = this.config.get<string>('R2_PUBLIC_BASE_URL');
    return baseUrl ? `${baseUrl.replace(/\/$/, '')}/${key}` : undefined;
  }

  async materialize(key: string): Promise<{ path: string; cleanup: () => Promise<void> }> {
    const localPath = this.localPathForKey(key);
    if (localPath) {
      return { path: localPath, cleanup: async () => undefined };
    }

    const body = await this.get(key);
    const temporaryPath = join(this.localRoot, '.tmp', `${Date.now()}-${basename(key)}`);
    await mkdir(dirname(temporaryPath), { recursive: true });
    await writeFile(temporaryPath, body);
    return {
      path: temporaryPath,
      cleanup: async () => {
        await unlink(temporaryPath).catch(() => undefined);
      },
    };
  }

  private async put(key: string, body: Buffer, contentType: string): Promise<void> {
    if (this.r2) {
      await this.r2.client.send(
        new PutObjectCommand({
          Bucket: this.r2.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
      return;
    }

    const path = join(this.localRoot, key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);
  }

  private extensionForMime(mime: string): string {
    if (mime === 'image/png') return '.png';
    if (mime === 'image/webp') return '.webp';
    return '.jpg';
  }

  private async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
    }
    return Buffer.concat(chunks);
  }
}
