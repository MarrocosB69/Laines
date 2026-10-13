import api from './api';

const dataUrlToBlob = (dataUrl) => {
  const [header, encoded] = String(dataUrl || '').split(',');
  if (!header || !encoded) throw new Error('Captura de imagem invalida.');
  const mimeType = header.match(/^data:([^;]+)/)?.[1] || 'image/jpeg';
  const binary = window.atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
};

const sha256Blob = async (blob) => {
  if (!window.crypto?.subtle) return null;
  const digest = await window.crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
};

const uploadBlob = ({ uploadUrl, authenticatedLocal, method = 'PUT', headers = {}, blob, onProgress }) => {
  if (authenticatedLocal) {
    // Send the session only to our configured API, never to a storage URL.
    const apiUrl = new URL(api.defaults.baseURL, window.location.origin);
    const apiPrefix = apiUrl.pathname.replace(/\/+$/, '');
    const url = new URL(uploadUrl, `${apiUrl.href.replace(/\/+$/, '')}/`);
    if (url.origin !== apiUrl.origin || !url.pathname.startsWith(`${apiPrefix}/avaliacoes-imagem/uploads/local/`)) {
      throw new Error('Destino de upload autenticado invalido.');
    }
    return api.put(url.href, blob, {
      headers, timeout: 120000,
      onUploadProgress: (event) => { if (event.total) onProgress?.(event.loaded / event.total); },
    });
  }
  return (
  new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open(method, uploadUrl, true);
    Object.entries(headers || {}).forEach(([name, value]) => {
      if (value != null) request.setRequestHeader(name, String(value));
    });
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };
    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress?.(1);
        resolve();
        return;
      }
      reject(new Error(`Upload recusado pelo armazenamento (HTTP ${request.status}).`));
    };
    request.onerror = () => reject(new Error('Falha de rede durante o upload da imagem.'));
    request.onabort = () => reject(new Error('Upload cancelado.'));
    request.timeout = 120000;
    request.ontimeout = () => reject(new Error('Tempo limite no upload. Tente novamente para retomar.'));
    request.send(blob);
  })
  );
};

const createEvaluation = async (payload) => {
  const { data } = await api.post('/avaliacoes-imagem', payload);
  return data;
};

const createUploadUrls = async (evaluationId) => {
  const { data } = await api.post(`/avaliacoes-imagem/${evaluationId}/upload-urls`);
  return data;
};

const listImageEvaluations = async (patientId) => {
  const { data } = await api.get('/avaliacoes', {
    params: { pacienteId: patientId, tipo: 'composicao_corporal_imagem', limit: 50 },
  });
  return Array.isArray(data) ? data : data?.items || [];
};

const findEvaluation = async (id) => {
  const { data } = await api.get(`/avaliacoes/${id}`);
  return data;
};

const findLatestEvaluation = async (patientId) => {
  const [latest] = await listImageEvaluations(patientId);
  if (!latest?.id) return null;
  return findEvaluation(latest.id);
};

const uploadCapture = async ({ evaluationId, descriptor, dataUrl, blob: providedBlob, onProgress }) => {
  const blob = providedBlob || dataUrlToBlob(dataUrl);
  const sha256 = await sha256Blob(blob);
  await uploadBlob({ ...descriptor, blob, onProgress });
  await api.post(
    `/avaliacoes-imagem/${evaluationId}/capturas/${descriptor.captureId}/concluir-upload`,
    { tamanhoBytes: blob.size, ...(sha256 ? { sha256 } : {}) },
  );
  return { size: blob.size, sha256 };
};

const getStatus = async (evaluationId) => {
  const { data } = await api.get(`/avaliacoes-imagem/${evaluationId}/status`);
  return data;
};

const getResults = async (evaluationId) => {
  const { data } = await api.get(`/avaliacoes-imagem/${evaluationId}/resultados`);
  return data;
};

const reprocessEvaluation = async (evaluationId) => {
  const { data } = await api.post(`/avaliacoes-imagem/${evaluationId}/reprocessar`);
  return data;
};

const deleteEvaluation = async (evaluationId) => {
  const { data } = await api.delete(`/avaliacoes-imagem/${evaluationId}`);
  return data;
};

export {
  createEvaluation,
  createUploadUrls,
  deleteEvaluation,
  findEvaluation,
  findLatestEvaluation,
  getResults,
  getStatus,
  listImageEvaluations,
  reprocessEvaluation,
  uploadCapture,
};
