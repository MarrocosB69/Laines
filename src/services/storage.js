import api from './api';

const normalizeAttachmentPath = (value) => String(value || '').replace(/\\/g, '/');

const extractAttachmentFilename = (attachment) => {
  const fromPath = normalizeAttachmentPath(attachment?.path);
  if (fromPath) {
    const pathChunks = fromPath.split('/').filter(Boolean);
    const candidate = pathChunks[pathChunks.length - 1];
    if (candidate) return candidate;
  }

  const fromUrl = String(attachment?.url || '').trim();
  if (!fromUrl) return '';
  try {
    const baseOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const parsed = new URL(fromUrl, baseOrigin);
    const chunks = parsed.pathname.split('/').filter(Boolean);
    return chunks[chunks.length - 1] || '';
  } catch {
    const chunks = fromUrl.split('/').filter(Boolean);
    return chunks[chunks.length - 1] || '';
  }
};

const uploadPatientAttachment = async (patientId, file) => {
  if (!patientId || !file) {
    throw new Error('Paciente e arquivo sao obrigatorios.');
  }

  const body = new FormData();
  body.append('file', file);

  const { data } = await api.post(`/pacientes/${patientId}/anexos`, body, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });

  return {
    id: data?.id,
    url: data?.url,
    path: data?.path,
    name: data?.name || file.name,
    size: data?.size ?? file.size,
    type: data?.type || file.type,
    uploadedAt: data?.uploadedAt,
    uploadedBy: data?.uploadedBy
  };
};

const downloadPatientAttachment = async (patientId, attachment) => {
  if (!patientId) {
    throw new Error('Paciente obrigatorio.');
  }

  const filename = extractAttachmentFilename(attachment);
  if (!filename) {
    throw new Error('Não foi possível identificar o anexo.');
  }

  const response = await api.get(`/pacientes/${patientId}/anexos/${encodeURIComponent(filename)}`, {
    responseType: 'blob'
  });
  const blob = response?.data;
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.download = attachment?.name || filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60000);
};

const deletePatientAttachment = async (patientId, attachment) => {
  if (!patientId) {
    throw new Error('Paciente obrigatorio.');
  }

  const filename = extractAttachmentFilename(attachment);
  if (!filename) {
    throw new Error('Não foi possível identificar o anexo.');
  }

  await api.delete(`/pacientes/${patientId}/anexos/${encodeURIComponent(filename)}`);
  return filename;
};

export { uploadPatientAttachment, downloadPatientAttachment, deletePatientAttachment };
