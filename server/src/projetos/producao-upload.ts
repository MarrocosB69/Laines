import { BadRequestException } from '@nestjs/common';
import { existsSync, lstatSync } from 'fs';
import { extname, isAbsolute, relative, resolve, sep } from 'path';

export const MAX_PRODUCTION_BYTES = 25 * 1024 * 1024;

export type ProductionUpload = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
  filename?: string;
};

const formats: Record<string, { mime: string; kind: string }> = {
  '.pdf': { mime: 'application/pdf', kind: 'pdf' },
  '.doc': { mime: 'application/msword', kind: 'ole' },
  '.docx': { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', kind: 'word' },
  '.ppt': { mime: 'application/vnd.ms-powerpoint', kind: 'ole' },
  '.pptx': { mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', kind: 'ppt' },
  '.xls': { mime: 'application/vnd.ms-excel', kind: 'ole' },
  '.xlsx': { mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', kind: 'xl' },
  '.png': { mime: 'image/png', kind: 'png' },
  '.jpg': { mime: 'image/jpeg', kind: 'jpeg' },
  '.jpeg': { mime: 'image/jpeg', kind: 'jpeg' }
};

export function validateProductionUpload(file: ProductionUpload) {
  const ext = extname(file.originalname || '').toLowerCase();
  const format = formats[ext];
  const bytes = file.buffer;
  if (!format || file.mimetype !== format.mime || !Buffer.isBuffer(bytes)
    || !bytes.length || bytes.length > MAX_PRODUCTION_BYTES) {
    throw new BadRequestException('Formato ou tamanho do arquivo invalido.');
  }
  const starts = (signature: number[]) => bytes.subarray(0, signature.length).equals(Buffer.from(signature));
  const zip = starts([80, 75, 3, 4]) && bytes.includes(Buffer.from('[Content_Types].xml'));
  const valid = format.kind === 'pdf' ? bytes.subarray(0, 5).toString('ascii') === '%PDF-'
    : format.kind === 'png' ? starts([137, 80, 78, 71, 13, 10, 26, 10])
      : format.kind === 'jpeg' ? starts([255, 216, 255])
        : format.kind === 'ole' ? starts([208, 207, 17, 224, 161, 177, 26, 225])
          : zip && bytes.includes(Buffer.from(`${format.kind}/`));
  if (!valid) throw new BadRequestException('Conteudo do arquivo nao corresponde ao formato informado.');
  return { ext, mime: format.mime };
}

export function productionUploadPath(uploadsDir: string, storedPath: string) {
  const root = resolve(process.cwd(), uploadsDir, 'projetos');
  const target = resolve(process.cwd(), uploadsDir, storedPath);
  const child = relative(root, target);
  if (!child || child === '..' || child.startsWith(`..${sep}`) || isAbsolute(child)) {
    throw new BadRequestException('Caminho de anexo invalido.');
  }
  if (existsSync(root) && lstatSync(root).isSymbolicLink()) {
    throw new BadRequestException('Caminho de anexo invalido.');
  }
  let cursor = root;
  for (const part of child.split(sep)) {
    cursor = resolve(cursor, part);
    if (existsSync(cursor) && lstatSync(cursor).isSymbolicLink()) {
      throw new BadRequestException('Caminho de anexo invalido.');
    }
  }
  return target;
}
