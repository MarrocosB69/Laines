import { BadRequestException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { lstatSync, realpathSync, existsSync } from 'fs';
import { extname, isAbsolute, relative, resolve, sep } from 'path';

export const CONTEUDO_MAX_BYTES = 10 * 1024 * 1024;

export function assertConteudoId(id: string) {
  if (!isUUID(id)) throw new BadRequestException('Identificador de conteudo invalido.');
}

export function conteudosRoot() {
  return resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads', 'conteudos');
}

// Reject both lexical traversal and existing symbolic links/junctions below the root.
export function containedConteudoPath(path: string) {
  const root = conteudosRoot();
  const target = resolve(process.cwd(), path);
  const child = relative(root, target);
  if (!child || child === '..' || child.startsWith(`..${sep}`) || isAbsolute(child)) {
    throw new BadRequestException('Caminho de arquivo invalido.');
  }
  let cursor = root;
  for (const part of child.split(sep)) {
    cursor = resolve(cursor, part);
    if (existsSync(cursor) && lstatSync(cursor).isSymbolicLink()) {
      throw new BadRequestException('Caminho de arquivo invalido.');
    }
  }
  if (existsSync(root) && existsSync(target)) {
    const actual = relative(realpathSync(root), realpathSync(target));
    if (actual === '..' || actual.startsWith(`..${sep}`) || isAbsolute(actual)) {
      throw new BadRequestException('Caminho de arquivo invalido.');
    }
  }
  return target;
}

export function validateConteudoFile(file: { originalname: string; mimetype: string; buffer: Buffer }) {
  const ext = extname(file.originalname || '').toLowerCase();
  const bytes = file.buffer;
  if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > CONTEUDO_MAX_BYTES) {
    throw new BadRequestException('Arquivo vazio ou maior que 10 MB.');
  }
  const starts = (signature: number[]) => bytes.subarray(0, signature.length).equals(Buffer.from(signature));
  const formats: Record<string, { mime: string; valid: boolean }> = {
    '.pdf': { mime: 'application/pdf', valid: bytes.subarray(0, 5).toString('ascii') === '%PDF-' },
    '.png': { mime: 'image/png', valid: starts([137, 80, 78, 71, 13, 10, 26, 10]) },
    '.jpg': { mime: 'image/jpeg', valid: starts([255, 216, 255]) },
    '.jpeg': { mime: 'image/jpeg', valid: starts([255, 216, 255]) },
    '.doc': { mime: 'application/msword', valid: starts([208, 207, 17, 224, 161, 177, 26, 225]) },
    '.docx': {
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      valid: starts([80, 75, 3, 4]) && bytes.includes(Buffer.from('[Content_Types].xml')) && bytes.includes(Buffer.from('word/document.xml'))
    }
  };
  const format = formats[ext];
  if (!format?.valid || file.mimetype !== format.mime) {
    throw new BadRequestException('Conteudo do arquivo nao corresponde a um formato permitido (PDF, DOC, DOCX, PNG ou JPG).');
  }
  return { ext, mime: format.mime };
}
