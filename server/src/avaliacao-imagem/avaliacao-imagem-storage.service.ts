import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { createReadStream, createWriteStream, existsSync, mkdirSync, renameSync, statSync, unlinkSync } from 'fs';
import { dirname, isAbsolute, relative, resolve } from 'path';
import { pipeline } from 'stream/promises';
import { Transform } from 'stream';
import { Client as MinioClient } from 'minio';

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 15 * 60;

type UploadDescriptor = {
  uploadUrl: string;
  method: 'PUT';
  headers: Record<string, string>;
  expiresAt: string;
  authenticatedLocal?: boolean;
};

type ObjectInspection = {
  size: number;
  sha256: string;
  detectedMimeType: 'image/jpeg' | 'video/webm' | 'video/mp4' | null;
};

@Injectable()
export class AvaliacaoImagemStorageService {
  private readonly driver = String(process.env.IMAGE_STORAGE_DRIVER || 'local').toLowerCase();
  private readonly bucket = process.env.MINIO_IMAGE_BUCKET || 'laines-imagens-corporais';
  private readonly localRoot = resolve(
    process.cwd(),
    process.env.UPLOAD_DIR || 'uploads',
    'avaliacoes-imagem',
  );
  private readonly signingSecret = String(
    process.env.IMAGE_UPLOAD_SIGNING_SECRET || process.env.JWT_SECRET || '',
  );
  private readonly minio: MinioClient | null;
  private bucketReady: Promise<void> | null = null;

  constructor() {
    if (this.driver !== 'minio') {
      this.minio = null;
      return;
    }

    const endPoint = String(process.env.MINIO_ENDPOINT || '').trim();
    const accessKey = String(process.env.MINIO_ACCESS_KEY || '').trim();
    const secretKey = String(process.env.MINIO_SECRET_KEY || '').trim();
    if (!endPoint || !accessKey || !secretKey) {
      this.minio = null;
      return;
    }

    this.minio = new MinioClient({
      endPoint,
      port: Number(process.env.MINIO_PORT || 9000),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey,
      secretKey,
      region: process.env.MINIO_REGION || 'us-east-1',
    });
  }

  private assertObjectKey(objectKey: string): void {
    if (!/^[a-zA-Z0-9/_-]+\.(?:jpe?g|webm|mp4)$/.test(objectKey) || objectKey.includes('..')) {
      throw new BadRequestException('Chave de armazenamento invalida.');
    }
  }

  private async ensureBucket(): Promise<void> {
    if (!this.minio) {
      throw new ServiceUnavailableException('Armazenamento MinIO nao configurado.');
    }
    if (!this.bucketReady) {
      this.bucketReady = (async () => {
        const exists = await this.minio!.bucketExists(this.bucket);
        if (!exists) {
          if (process.env.MINIO_AUTO_CREATE_BUCKET === 'false') {
            throw new ServiceUnavailableException('Bucket privado de imagens nao encontrado.');
          }
          await this.minio!.makeBucket(this.bucket, process.env.MINIO_REGION || 'us-east-1');
        }
      })().catch((error) => {
        this.bucketReady = null;
        throw error;
      });
    }
    return this.bucketReady;
  }

  private signLocalToken(objectKey: string, maxBytes: number): string {
    if (!this.signingSecret) {
      throw new ServiceUnavailableException('Segredo de assinatura de upload nao configurado.');
    }
    const payload = Buffer.from(JSON.stringify({
      key: objectKey,
      exp: Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SECONDS,
      max: Math.min(maxBytes, MAX_UPLOAD_BYTES),
    })).toString('base64url');
    const signature = createHmac('sha256', this.signingSecret).update(payload).digest('base64url');
    return `${payload}.${signature}`;
  }

  private verifyLocalToken(token: string): { key: string; max: number } {
    if (!this.signingSecret) {
      throw new UnauthorizedException('Assinatura de upload indisponivel.');
    }
    const [payload, providedSignature] = String(token || '').split('.');
    if (!payload || !providedSignature) {
      throw new UnauthorizedException('URL de upload invalida.');
    }
    const expected = createHmac('sha256', this.signingSecret).update(payload).digest();
    let provided: Buffer;
    try {
      provided = Buffer.from(providedSignature, 'base64url');
    } catch {
      throw new UnauthorizedException('URL de upload invalida.');
    }
    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      throw new UnauthorizedException('URL de upload invalida.');
    }
    let decoded: { key?: string; exp?: number; max?: number };
    try {
      decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    } catch {
      throw new UnauthorizedException('URL de upload invalida.');
    }
    if (!decoded.key || !decoded.exp || decoded.exp < Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException('URL de upload expirada.');
    }
    this.assertObjectKey(decoded.key);
    return { key: decoded.key, max: Math.min(Number(decoded.max) || MAX_UPLOAD_BYTES, MAX_UPLOAD_BYTES) };
  }

  private localPath(objectKey: string): string {
    this.assertObjectKey(objectKey);
    const fullPath = resolve(this.localRoot, objectKey);
    const relativePath = relative(this.localRoot, fullPath);
    if (!relativePath || relativePath.startsWith('..') || isAbsolute(relativePath)) {
      throw new BadRequestException('Caminho de armazenamento invalido.');
    }
    return fullPath;
  }

  localUploadObjectKey(token: string): string {
    return this.verifyLocalToken(token).key;
  }

  async createUploadDescriptor(
    objectKey: string,
    options?: { mimeType?: string; maxBytes?: number },
  ): Promise<UploadDescriptor> {
    this.assertObjectKey(objectKey);
    const mimeType = options?.mimeType || 'application/octet-stream';
    const maxBytes = Math.min(options?.maxBytes || MAX_UPLOAD_BYTES, MAX_UPLOAD_BYTES);
    const expiresAt = new Date(Date.now() + SIGNED_URL_TTL_SECONDS * 1000).toISOString();
    if (this.driver === 'minio') {
      await this.ensureBucket();
      const uploadUrl = await this.minio!.presignedPutObject(
        this.bucket,
        objectKey,
        SIGNED_URL_TTL_SECONDS,
      );
      return { uploadUrl, method: 'PUT', headers: { 'Content-Type': mimeType }, expiresAt };
    }

    const baseUrl = String(
      process.env.IMAGE_UPLOAD_BASE_URL
      || process.env.UPLOAD_BASE_URL
      || process.env.API_BASE_URL
      || 'http://localhost:4000',
    ).replace(/\/+$/, '');
    const token = this.signLocalToken(objectKey, maxBytes);
    return {
      uploadUrl: `${baseUrl}/avaliacoes-imagem/uploads/local/${token}`,
      authenticatedLocal: true,
      method: 'PUT',
      headers: { 'Content-Type': mimeType },
      expiresAt,
    };
  }

  async saveLocalUpload(
    token: string,
    input: NodeJS.ReadableStream,
    contentLength?: number,
  ): Promise<{ size: number }> {
    if (this.driver === 'minio') {
      throw new BadRequestException('Endpoint local desabilitado.');
    }
    const signed = this.verifyLocalToken(token);
    if (Number.isFinite(contentLength) && Number(contentLength) > signed.max) {
      throw new BadRequestException('Imagem excede o tamanho permitido.');
    }
    const finalPath = this.localPath(signed.key);
    mkdirSync(dirname(finalPath), { recursive: true });
    const tempPath = `${finalPath}.${Date.now()}.upload`;
    let total = 0;
    const limiter = new Transform({
      transform(chunk, _encoding, callback) {
        total += chunk.length;
        if (total > signed.max) {
          callback(new Error('UPLOAD_TOO_LARGE'));
          return;
        }
        callback(null, chunk);
      },
    });
    try {
      await pipeline(input, limiter, createWriteStream(tempPath, { flags: 'wx' }));
      if (total < 1) throw new Error('UPLOAD_EMPTY');
      renameSync(tempPath, finalPath);
      return { size: total };
    } catch (error) {
      if (existsSync(tempPath)) unlinkSync(tempPath);
      if (error instanceof Error && error.message === 'UPLOAD_TOO_LARGE') {
        throw new BadRequestException('Imagem excede o tamanho permitido.');
      }
      throw new BadRequestException('Nao foi possivel receber a imagem.');
    }
  }

  async statObject(objectKey: string): Promise<{ size: number }> {
    this.assertObjectKey(objectKey);
    if (this.driver === 'minio') {
      await this.ensureBucket();
      try {
        const stat = await this.minio!.statObject(this.bucket, objectKey);
        return { size: Number(stat.size || 0) };
      } catch {
        throw new BadRequestException('Upload ainda nao localizado no armazenamento.');
      }
    }
    const path = this.localPath(objectKey);
    if (!existsSync(path)) {
      throw new BadRequestException('Upload ainda nao localizado no armazenamento.');
    }
    return { size: statSync(path).size };
  }

  private detectMimeType(header: Buffer): ObjectInspection['detectedMimeType'] {
    if (header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) {
      return 'image/jpeg';
    }
    if (header.length >= 4 && header.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) {
      return 'video/webm';
    }
    if (header.length >= 12 && header.subarray(4, 8).toString('ascii') === 'ftyp') {
      return 'video/mp4';
    }
    return null;
  }

  async inspectObject(objectKey: string): Promise<ObjectInspection> {
    const { size } = await this.statObject(objectKey);
    const stream = this.driver === 'minio'
      ? await (async () => {
          await this.ensureBucket();
          return this.minio!.getObject(this.bucket, objectKey);
        })()
      : createReadStream(this.localPath(objectKey));
    const hash = createHash('sha256');
    const headerChunks: Buffer[] = [];
    let headerLength = 0;
    let streamedSize = 0;
    for await (const rawChunk of stream) {
      const chunk = Buffer.isBuffer(rawChunk) ? rawChunk : Buffer.from(rawChunk);
      streamedSize += chunk.length;
      hash.update(chunk);
      if (headerLength < 16) {
        const slice = chunk.subarray(0, 16 - headerLength);
        headerChunks.push(slice);
        headerLength += slice.length;
      }
    }
    if (streamedSize !== size) {
      throw new BadRequestException('Arquivo mudou durante a validacao do upload.');
    }
    const header = Buffer.concat(headerChunks);
    return {
      size,
      sha256: hash.digest('hex'),
      detectedMimeType: this.detectMimeType(header),
    };
  }

  async deleteObject(objectKey: string): Promise<void> {
    this.assertObjectKey(objectKey);
    if (this.driver === 'minio') {
      await this.ensureBucket();
      await this.minio!.removeObject(this.bucket, objectKey);
      return;
    }
    const path = this.localPath(objectKey);
    if (existsSync(path)) unlinkSync(path);
  }

  async createProcessorSource(objectKey: string): Promise<Record<string, string>> {
    this.assertObjectKey(objectKey);
    if (this.driver === 'minio') {
      await this.ensureBucket();
      const url = await this.minio!.presignedGetObject(
        this.bucket,
        objectKey,
        SIGNED_URL_TTL_SECONDS,
      );
      return { type: 'url', url };
    }
    return { type: 'local_path', path: this.localPath(objectKey) };
  }
}
