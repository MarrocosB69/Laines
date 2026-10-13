import React, { useEffect, useMemo, useState } from 'react';
import { FileText, Image, UploadCloud, X } from 'lucide-react';
import './ui.css';

const IMAGE_EXTENSIONS = new Set(['gif', 'jpeg', 'jpg', 'png', 'svg', 'webp']);

const MIME_EXTENSION_MAP = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/svg+xml': 'svg',
  'image/webp': 'webp'
};

const getExtension = (name = '', mimeType = '') => {
  const mapped = MIME_EXTENSION_MAP[String(mimeType || '').toLowerCase()];
  if (mapped) return mapped;

  const cleanName = String(name || '').split('?')[0].split('#')[0];
  const parts = cleanName.split('.');
  if (parts.length < 2) return '';
  return String(parts.pop() || '').toLowerCase();
};

const formatFileSize = (size) => {
  const bytes = Number(size);
  if (!Number.isFinite(bytes) || bytes <= 0) return '';

  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const precision = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
};

const AttachmentThumbnail = ({
  className = '',
  compact = false,
  description = '',
  emptyDescription = 'PDF, DOC, PNG ou JPG',
  emptyTitle = 'Selecionar arquivo',
  file = null,
  mimeType = '',
  name = '',
  onRemove = null,
  removeLabel = 'Remover arquivo',
  size = null,
  title = ''
}) => {
  const fileName = file?.name || name || '';
  const fileSize = file?.size ?? size;
  const fileMimeType = file?.type || mimeType || '';
  const extension = getExtension(fileName, fileMimeType);
  const hasFile = Boolean(file || fileName);
  const isImage = IMAGE_EXTENSIONS.has(extension);
  const sizeLabel = formatFileSize(fileSize);
  const [previewUrl, setPreviewUrl] = useState('');

  useEffect(() => {
    if (!file || !isImage) {
      setPreviewUrl('');
      return undefined;
    }

    const nextUrl = URL.createObjectURL(file);
    setPreviewUrl(nextUrl);

    return () => URL.revokeObjectURL(nextUrl);
  }, [file, isImage]);

  const metaLabel = useMemo(() => {
    if (!hasFile) return emptyDescription;
    if (description) return description;
    return [extension ? extension.toUpperCase() : 'Arquivo', sizeLabel].filter(Boolean).join(' - ');
  }, [description, emptyDescription, extension, hasFile, sizeLabel]);

  const RootIcon = hasFile ? (isImage ? Image : FileText) : UploadCloud;
  const rootClassName = [
    'attachment-thumbnail',
    compact ? 'attachment-thumbnail--compact' : '',
    hasFile ? 'attachment-thumbnail--filled' : 'attachment-thumbnail--empty',
    className
  ].filter(Boolean).join(' ');

  const handleRemove = (event) => {
    event.preventDefault();
    event.stopPropagation();
    onRemove?.();
  };

  const handleRemoveKeyDown = (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    handleRemove(event);
  };

  return (
    <div className={rootClassName}>
      <span className="attachment-thumbnail__preview" aria-hidden="true">
        {previewUrl ? (
          <img src={previewUrl} alt="" />
        ) : (
          <RootIcon size={compact ? 18 : 24} />
        )}
        {hasFile && (
          <span className="attachment-thumbnail__extension">
            {extension ? extension.slice(0, 4).toUpperCase() : 'ARQ'}
          </span>
        )}
      </span>
      <span className="attachment-thumbnail__content">
        <span className="attachment-thumbnail__title">
          {hasFile ? (title || fileName || 'Arquivo selecionado') : emptyTitle}
        </span>
        <span className="attachment-thumbnail__description">
          {metaLabel}
        </span>
      </span>
      {hasFile && onRemove && (
        <span
          className="attachment-thumbnail__remove"
          role="button"
          tabIndex={0}
          aria-label={removeLabel}
          onClick={handleRemove}
          onKeyDown={handleRemoveKeyDown}
        >
          <X size={14} />
        </span>
      )}
    </div>
  );
};

export default AttachmentThumbnail;
