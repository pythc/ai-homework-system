import { Injectable, Logger } from '@nestjs/common';
import { createReadStream, createWriteStream } from 'fs';
import { promises as fs } from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

type ParsedRef =
  | { kind: 'empty' }
  | { kind: 'http'; url: string }
  | { kind: 's3'; bucket: string; key: string }
  | { kind: 'local'; key: string }
  | { kind: 'legacy-path'; absolutePath: string };

type PersistOptions = {
  prefix: string;
  originalName?: string;
  contentType?: string;
};

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly backend: 'local' | 's3' =
    String(process.env.STORAGE_BACKEND || 'local').toLowerCase() === 's3'
      ? 's3'
      : 'local';
  private readonly localRoot = path.resolve(
    process.cwd(),
    process.env.LOCAL_STORAGE_ROOT || 'uploads',
  );
  private readonly localPublicBase = this.normalizePublicBase(
    process.env.LOCAL_STORAGE_PUBLIC_BASE || '/uploads',
  );
  private readonly signedUrlTtlSeconds = this.readNumberEnv(
    'STORAGE_SIGNED_URL_TTL_SECONDS',
    900,
  );
  private readonly s3Bucket = process.env.S3_BUCKET || 'ai-homework-files';
  private readonly s3Region = process.env.S3_REGION || 'us-east-1';
  private readonly s3Endpoint = process.env.S3_ENDPOINT || undefined;
  private readonly s3ForcePathStyle = String(
    process.env.S3_FORCE_PATH_STYLE || 'true',
  ).toLowerCase() !== 'false';
  private readonly s3PublicBaseUrl =
    process.env.S3_PUBLIC_BASE_URL?.trim() || '';
  private readonly s3Client?: S3Client;

  constructor() {
    if (this.backend !== 's3') {
      return;
    }
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
    this.s3Client = new S3Client({
      region: this.s3Region,
      endpoint: this.s3Endpoint,
      forcePathStyle: this.s3ForcePathStyle,
      credentials:
        accessKeyId && secretAccessKey
          ? { accessKeyId, secretAccessKey }
          : undefined,
    });
  }

  isLocalBackend() {
    return this.backend === 'local';
  }

  async persistUploadedFile(
    tempFilePath: string,
    options: PersistOptions,
  ): Promise<string> {
    if (this.backend === 'local') {
      const key = this.buildObjectKey(options.prefix, options.originalName);
      const destination = path.join(this.localRoot, key);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.rename(tempFilePath, destination);
      return this.toLocalRef(key);
    }

    const key = this.buildObjectKey(options.prefix, options.originalName);
    const body = createReadStream(tempFilePath);
    try {
      await this.ensureS3Client().send(
        new PutObjectCommand({
          Bucket: this.s3Bucket,
          Key: key,
          Body: body,
          ContentType: options.contentType,
        }),
      );
      return this.toS3Ref(this.s3Bucket, key);
    } finally {
      await fs.unlink(tempFilePath).catch(() => undefined);
    }
  }

  async persistBuffer(
    buffer: Buffer,
    options: PersistOptions,
  ): Promise<string> {
    const key = this.buildObjectKey(options.prefix, options.originalName);
    if (this.backend === 'local') {
      const destination = path.join(this.localRoot, key);
      await fs.mkdir(path.dirname(destination), { recursive: true });
      await fs.writeFile(destination, buffer);
      return this.toLocalRef(key);
    }

    await this.ensureS3Client().send(
      new PutObjectCommand({
        Bucket: this.s3Bucket,
        Key: key,
        Body: buffer,
        ContentType: options.contentType,
      }),
    );
    return this.toS3Ref(this.s3Bucket, key);
  }

  async resolvePublicUrl(fileRef: string): Promise<string> {
    const parsed = this.parseRef(fileRef);
    if (parsed.kind === 'empty') {
      return '';
    }
    if (parsed.kind === 'http') {
      return parsed.url;
    }
    if (parsed.kind === 'local') {
      return `${this.localPublicBase}/${parsed.key}`;
    }
    if (parsed.kind === 'legacy-path') {
      const key = this.localKeyFromAbsolutePath(parsed.absolutePath);
      if (!key) {
        return parsed.absolutePath;
      }
      return `${this.localPublicBase}/${key}`;
    }
    const signed = await this.buildSignedS3Url(
      parsed.bucket,
      parsed.key,
      this.signedUrlTtlSeconds,
    );
    return this.mapS3UrlToPublicBase(signed);
  }

  async resolvePublicUrls(fileRefs: string[]): Promise<string[]> {
    return Promise.all(fileRefs.map((item) => this.resolvePublicUrl(item)));
  }

  async deleteByRef(fileRef: string): Promise<void> {
    const parsed = this.parseRef(fileRef);
    if (parsed.kind === 'empty' || parsed.kind === 'http') {
      return;
    }
    if (parsed.kind === 'legacy-path') {
      await fs.unlink(parsed.absolutePath).catch(() => undefined);
      return;
    }
    if (parsed.kind === 'local') {
      await fs.unlink(path.join(this.localRoot, parsed.key)).catch(() => undefined);
      return;
    }
    await this.ensureS3Client()
      .send(
        new DeleteObjectCommand({
          Bucket: parsed.bucket,
          Key: parsed.key,
        }),
      )
      .catch(() => undefined);
  }

  async deleteMany(fileRefs: string[]): Promise<void> {
    const unique = Array.from(
      new Set(fileRefs.map((item) => item?.trim()).filter(Boolean)),
    ) as string[];
    await Promise.all(
      unique.map((item) =>
        this.deleteByRef(item).catch((error) => {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.warn(`delete failed for ${item}: ${message}`);
        }),
      ),
    );
  }

  async materializeForProcessing(
    fileRef: string,
    tempDir: string,
  ): Promise<{ filePath: string; temporary: boolean } | null> {
    const parsed = this.parseRef(fileRef);
    if (parsed.kind === 'empty') {
      return null;
    }
    if (parsed.kind === 'http') {
      const downloaded = await this.downloadHttpToTemp(parsed.url, tempDir);
      return downloaded
        ? { filePath: downloaded, temporary: true }
        : null;
    }
    if (parsed.kind === 'legacy-path') {
      if (await this.fileExists(parsed.absolutePath)) {
        return { filePath: parsed.absolutePath, temporary: false };
      }
      return null;
    }
    if (parsed.kind === 'local') {
      const localPath = path.join(this.localRoot, parsed.key);
      if (await this.fileExists(localPath)) {
        return { filePath: localPath, temporary: false };
      }
      return null;
    }
    const downloaded = await this.downloadS3ToTemp(
      parsed.bucket,
      parsed.key,
      tempDir,
    );
    return downloaded ? { filePath: downloaded, temporary: true } : null;
  }

  private async buildSignedS3Url(
    bucket: string,
    key: string,
    expiresInSeconds: number,
  ) {
    return getSignedUrl(
      this.ensureS3Client(),
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
      { expiresIn: expiresInSeconds },
    );
  }

  private mapS3UrlToPublicBase(url: string) {
    if (!this.s3PublicBaseUrl) {
      return url;
    }
    try {
      const signedUrl = new URL(url);
      if (this.s3PublicBaseUrl.startsWith('/')) {
        const prefix = this.s3PublicBaseUrl.replace(/\/+$/, '');
        return `${prefix}${signedUrl.pathname}${signedUrl.search}`;
      }
      const publicBase = new URL(this.s3PublicBaseUrl);
      const merged = new URL(publicBase.toString());
      const prefix = publicBase.pathname.replace(/\/+$/, '');
      const tail = signedUrl.pathname.startsWith('/')
        ? signedUrl.pathname
        : `/${signedUrl.pathname}`;
      merged.pathname = `${prefix}${tail}`.replace(/\/{2,}/g, '/');
      merged.search = signedUrl.search;
      return merged.toString();
    } catch {
      return url;
    }
  }

  private parseRef(fileRef: string): ParsedRef {
    const value = String(fileRef || '').trim();
    if (!value) {
      return { kind: 'empty' };
    }
    if (/^https?:\/\//i.test(value)) {
      return { kind: 'http', url: value };
    }
    if (value.startsWith('s3://')) {
      const normalized = value.slice(5);
      const slash = normalized.indexOf('/');
      if (slash <= 0) {
        return { kind: 'empty' };
      }
      const bucket = normalized.slice(0, slash);
      const key = normalized.slice(slash + 1);
      return { kind: 's3', bucket, key };
    }
    if (value.startsWith('local://')) {
      const key = this.normalizeObjectKey(value.slice(8));
      return key ? { kind: 'local', key } : { kind: 'empty' };
    }
    if (value.startsWith(`${this.localPublicBase}/`)) {
      const key = this.normalizeObjectKey(
        value.slice(this.localPublicBase.length + 1),
      );
      return key ? { kind: 'local', key } : { kind: 'empty' };
    }
    if (value.startsWith('/uploads/')) {
      const key = this.normalizeObjectKey(value.slice('/uploads/'.length));
      return key ? { kind: 'local', key } : { kind: 'empty' };
    }
    if (path.isAbsolute(value)) {
      return { kind: 'legacy-path', absolutePath: value };
    }
    const key = this.normalizeObjectKey(value);
    return key ? { kind: 'local', key } : { kind: 'empty' };
  }

  private localKeyFromAbsolutePath(absolutePath: string): string | null {
    const normalized = absolutePath.replace(/\\/g, '/');
    const marker = '/uploads/';
    const markerIndex = normalized.lastIndexOf(marker);
    if (markerIndex !== -1) {
      const key = normalized.slice(markerIndex + marker.length);
      return this.normalizeObjectKey(key);
    }
    const relative = path.relative(this.localRoot, absolutePath);
    if (relative.startsWith('..')) {
      return null;
    }
    return this.normalizeObjectKey(relative);
  }

  private buildObjectKey(prefix: string, originalName?: string) {
    const cleanPrefix = this.normalizeObjectKey(prefix) || 'misc';
    const extension = this.safeExtension(originalName);
    const date = new Date();
    const datePath = `${date.getUTCFullYear()}/${String(
      date.getUTCMonth() + 1,
    ).padStart(2, '0')}/${String(date.getUTCDate()).padStart(2, '0')}`;
    return `${cleanPrefix}/${datePath}/${randomUUID()}${extension}`;
  }

  private normalizeObjectKey(raw: string) {
    const normalized = String(raw || '')
      .replace(/\\/g, '/')
      .split('/')
      .map((part) => part.trim())
      .filter((part) => part && part !== '.' && part !== '..')
      .join('/');
    return normalized || '';
  }

  private normalizePublicBase(raw: string) {
    const value = String(raw || '/uploads').trim();
    if (!value) return '/uploads';
    const base = value.startsWith('/') ? value : `/${value}`;
    return base.replace(/\/+$/, '');
  }

  private safeExtension(fileName?: string) {
    if (!fileName) return '';
    const ext = path.extname(fileName).toLowerCase();
    if (!ext || ext.length > 10) {
      return '';
    }
    return /^[.a-z0-9]+$/.test(ext) ? ext : '';
  }

  private toLocalRef(key: string) {
    return `local://${key}`;
  }

  private toS3Ref(bucket: string, key: string) {
    return `s3://${bucket}/${key}`;
  }

  private ensureS3Client() {
    if (!this.s3Client) {
      throw new Error('S3 client is not configured');
    }
    return this.s3Client;
  }

  private async downloadS3ToTemp(
    bucket: string,
    key: string,
    tempDir: string,
  ): Promise<string | null> {
    const extension = this.safeExtension(key);
    const destination = path.join(tempDir, `${randomUUID()}${extension}`);
    const response = await this.ensureS3Client()
      .send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: key,
        }),
      )
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`download s3 failed s3://${bucket}/${key}: ${message}`);
        return null;
      });
    const body = response?.Body;
    if (!body) {
      return null;
    }
    const ok = await this.writeReadableBody(body, destination);
    return ok ? destination : null;
  }

  private async downloadHttpToTemp(url: string, tempDir: string): Promise<string | null> {
    const response = await fetch(url).catch(() => null);
    if (!response?.ok) {
      return null;
    }
    const extension = this.safeExtension(new URL(url).pathname);
    const destination = path.join(tempDir, `${randomUUID()}${extension}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(destination, buffer);
    return destination;
  }

  private async writeReadableBody(
    body: unknown,
    destination: string,
  ): Promise<boolean> {
    if (body instanceof Readable) {
      await pipeline(body, createWriteStream(destination));
      return true;
    }
    if (
      body &&
      typeof body === 'object' &&
      'getReader' in body &&
      typeof (body as { getReader?: unknown }).getReader === 'function'
    ) {
      await pipeline(
        Readable.fromWeb(body as any),
        createWriteStream(destination),
      );
      return true;
    }
    if (
      body &&
      typeof body === 'object' &&
      'transformToByteArray' in body &&
      typeof (body as { transformToByteArray?: unknown }).transformToByteArray ===
        'function'
    ) {
      const bytes = await (
        body as { transformToByteArray: () => Promise<Uint8Array> }
      ).transformToByteArray();
      await fs.writeFile(destination, Buffer.from(bytes));
      return true;
    }
    return false;
  }

  private async fileExists(filePath: string) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private readNumberEnv(name: string, fallback: number): number {
    const value = Number(process.env[name]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }
}
