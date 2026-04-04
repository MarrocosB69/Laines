const apiBaseUrl = process.env.E2E_API_BASE_URL || process.env.API_BASE_URL || 'http://localhost:4000';
const adminEmail = process.env.E2E_ADMIN_EMAIL || process.env.E2E_EMAIL || '';
const adminPassword = process.env.E2E_ADMIN_PASSWORD || process.env.E2E_PASSWORD || '';
const isCi = /^(1|true)$/i.test(String(process.env.CI || ''));

const missing = [];
if (!adminEmail) missing.push('E2E_ADMIN_EMAIL|E2E_EMAIL');
if (!adminPassword) missing.push('E2E_ADMIN_PASSWORD|E2E_PASSWORD');

if (missing.length > 0) {
  if (isCi) {
    console.error(`[e2e-avaliacoes] Fail: faltam variaveis ${missing.join(', ')}`);
    process.exit(1);
  }
  console.log(`[e2e-avaliacoes] Skip: faltam variaveis ${missing.join(', ')}`);
  process.exit(0);
}

const ensure = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const extractErrorMessage = (body) => {
  if (!body) return '';
  if (typeof body.message === 'string') return body.message;
  if (Array.isArray(body.message)) return body.message.join(' | ');
  return JSON.stringify(body);
};

const requestJson = async (path, options = {}) => {
  const response = await fetch(`${apiBaseUrl}${path}`, options);
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { response, body };
};

const requestDelete = async (path, token) => (
  fetch(`${apiBaseUrl}${path}`, {
    method: 'DELETE',
    headers: {
      authorization: `Bearer ${token}`
    }
  })
);

const createPacientePayload = () => {
  const timestamp = Date.now();
  const randomSuffix = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  const digits = String(timestamp).replace(/\D/g, '').slice(-8);
  const cpf = `999${digits}${randomSuffix}`.slice(0, 11);
  return {
    nome: `E2E Avaliacoes ${timestamp}`,
    cpf,
    status: 'Lista de Espera',
    objetivo: 'performance',
    intensidade: 'moderada',
    tipoTreino: 'misto'
  };
};

const run = async () => {
  console.log(`[e2e-avaliacoes] API base: ${apiBaseUrl}`);

  const createdAvaliacaoIds = [];
  let pacienteId = null;
  let token = '';

  try {
    const login = await requestJson('/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: adminPassword })
    });
    ensure(login.response.ok, `Falha no login admin: HTTP ${login.response.status}`);
    token = String(login.body?.accessToken || '');
    ensure(token.length > 10, 'Token admin ausente.');
    console.log('[e2e-avaliacoes] login admin ok');

    const authHeaders = {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json'
    };

    const pacientePayload = createPacientePayload();
    const pacienteCreate = await requestJson('/pacientes', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(pacientePayload)
    });
    ensure(
      pacienteCreate.response.ok,
      `Falha ao criar paciente de teste: HTTP ${pacienteCreate.response.status} - ${extractErrorMessage(pacienteCreate.body)}`
    );
    pacienteId = String(pacienteCreate.body?.id || '');
    ensure(pacienteId.length > 10, 'Paciente de teste sem id valido.');
    console.log('[e2e-avaliacoes] paciente de teste criado');

    const alimentarInvalid = await requestJson('/avaliacoes', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        tipo: 'alimentar',
        status: 'finalizada',
        pacienteId,
        dados: {
          categorias: {
            in_natura: 0,
            minimamente_processados: 0,
            processados: 0,
            ultraprocessados: 0
          }
        }
      })
    });
    ensure(alimentarInvalid.response.status === 400, `Esperado 400 para alimentar invalida, recebido ${alimentarInvalid.response.status}`);
    ensure(
      /Avaliacao alimentar exige informar kcal consumidas nos grupos NOVA/i.test(extractErrorMessage(alimentarInvalid.body)),
      `Mensagem inesperada para alimentar invalida: ${extractErrorMessage(alimentarInvalid.body)}`
    );
    console.log('[e2e-avaliacoes] bloqueio de alimentar finalizada invalida ok');

    const alimentarValid = await requestJson('/avaliacoes', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        tipo: 'alimentar',
        status: 'finalizada',
        pacienteId,
        dados: {
          kcalInNatura: 420,
          kcalMinimamenteProcessados: 280,
          kcalProcessados: 160,
          kcalUltraprocessados: 140
        }
      })
    });
    ensure(
      alimentarValid.response.ok,
      `Falha ao criar alimentar valida: HTTP ${alimentarValid.response.status} - ${extractErrorMessage(alimentarValid.body)}`
    );
    const alimentarId = String(alimentarValid.body?.id || '');
    const sessaoId = String(alimentarValid.body?.sessaoId || '');
    ensure(alimentarId.length > 10, 'Avaliacao alimentar valida sem id.');
    ensure(sessaoId.length > 10, 'Avaliacao alimentar valida sem sessaoId.');
    ensure(alimentarValid.body?.status === 'finalizada', `Status inesperado da alimentar valida: ${alimentarValid.body?.status}`);
    createdAvaliacaoIds.push(alimentarId);
    console.log('[e2e-avaliacoes] alimentar finalizada valida ok');

    const alimentarConflict = await requestJson('/avaliacoes', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        tipo: 'alimentar',
        status: 'finalizada',
        pacienteId,
        sessaoId,
        dados: {
          kcalInNatura: 300,
          kcalMinimamenteProcessados: 300,
          kcalProcessados: 200,
          kcalUltraprocessados: 200
        }
      })
    });
    ensure(alimentarConflict.response.status === 409, `Esperado 409 para conflito por sessao/tipo, recebido ${alimentarConflict.response.status}`);
    ensure(
      /Ja existe uma avaliacao do tipo informado nesta sessao/i.test(extractErrorMessage(alimentarConflict.body)),
      `Mensagem inesperada para conflito de sessao: ${extractErrorMessage(alimentarConflict.body)}`
    );
    console.log('[e2e-avaliacoes] conflito por tipo/sessao ok');

    const hidratacaoValid = await requestJson('/avaliacoes', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        tipo: 'hidratacao',
        status: 'finalizada',
        pacienteId,
        sessaoId,
        dados: {
          pesoAntesExercicio: 70,
          pesoAposExercicio: 68.9,
          duracaoExercicioMin: 60,
          volumeIngeridoMl: 500,
          volumeUrinarioMl: 100
        }
      })
    });
    ensure(
      hidratacaoValid.response.ok,
      `Falha ao criar hidratacao valida: HTTP ${hidratacaoValid.response.status} - ${extractErrorMessage(hidratacaoValid.body)}`
    );
    const hidratacaoId = String(hidratacaoValid.body?.id || '');
    ensure(hidratacaoId.length > 10, 'Avaliacao hidratacao valida sem id.');
    ensure(String(hidratacaoValid.body?.sessaoId || '') === sessaoId, 'Hidratacao nao foi vinculada a mesma sessao informada.');
    createdAvaliacaoIds.push(hidratacaoId);
    console.log('[e2e-avaliacoes] hidratacao finalizada valida na mesma sessao ok');

    const fisioDraft = await requestJson('/avaliacoes', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        tipo: 'fisioterapia',
        status: 'rascunho',
        pacienteId,
        sessaoId,
        dados: {
          queixaPrincipal: '',
          intensidadeDor: ''
        }
      })
    });
    ensure(
      fisioDraft.response.ok,
      `Falha ao criar fisioterapia rascunho: HTTP ${fisioDraft.response.status} - ${extractErrorMessage(fisioDraft.body)}`
    );
    const fisioDraftId = String(fisioDraft.body?.id || '');
    ensure(fisioDraftId.length > 10, 'Fisioterapia rascunho sem id.');
    createdAvaliacaoIds.push(fisioDraftId);
    console.log('[e2e-avaliacoes] fisioterapia rascunho criada');

    const fisioFinalizeInvalid = await requestJson(`/avaliacoes/${fisioDraftId}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        status: 'finalizada'
      })
    });
    ensure(fisioFinalizeInvalid.response.status === 400, `Esperado 400 ao finalizar fisioterapia incompleta, recebido ${fisioFinalizeInvalid.response.status}`);
    ensure(
      /Fisioterapia exige queixa principal e intensidade de dor \(0-10\) para finalizar/i.test(extractErrorMessage(fisioFinalizeInvalid.body)),
      `Mensagem inesperada ao finalizar fisioterapia incompleta: ${extractErrorMessage(fisioFinalizeInvalid.body)}`
    );
    console.log('[e2e-avaliacoes] bloqueio de patch finalizada invalida ok');

    const fisioFinalizeValid = await requestJson(`/avaliacoes/${fisioDraftId}`, {
      method: 'PATCH',
      headers: authHeaders,
      body: JSON.stringify({
        status: 'finalizada',
        dados: {
          queixaPrincipal: 'Dor lombar ao agachar',
          intensidadeDor: 7,
          mobilidade: 'Limitada'
        }
      })
    });
    ensure(
      fisioFinalizeValid.response.ok,
      `Falha ao finalizar fisioterapia valida: HTTP ${fisioFinalizeValid.response.status} - ${extractErrorMessage(fisioFinalizeValid.body)}`
    );
    ensure(fisioFinalizeValid.body?.status === 'finalizada', `Status final inesperado da fisioterapia: ${fisioFinalizeValid.body?.status}`);
    console.log('[e2e-avaliacoes] patch rascunho -> finalizada ok');

    const pendencias = await requestJson(`/avaliacoes/pendencias/${pacienteId}`, {
      headers: {
        authorization: `Bearer ${token}`
      }
    });
    ensure(pendencias.response.ok, `Falha ao consultar pendencias: HTTP ${pendencias.response.status}`);
    ensure(Array.isArray(pendencias.body), 'Pendencias deve retornar uma lista.');
    console.log('[e2e-avaliacoes] endpoint de pendencias ok');

    console.log('[e2e-avaliacoes] Fluxo de finalizacao de avaliacoes validado com sucesso.');
  } finally {
    if (token && createdAvaliacaoIds.length > 0) {
      const uniqueIds = Array.from(new Set(createdAvaliacaoIds)).reverse();
      for (const avaliacaoId of uniqueIds) {
        try {
          const response = await requestDelete(`/avaliacoes/${avaliacaoId}`, token);
          if (!response.ok && response.status !== 404) {
            console.warn(`[e2e-avaliacoes] cleanup avaliacao ${avaliacaoId} retornou HTTP ${response.status}`);
          }
        } catch (error) {
          console.warn(`[e2e-avaliacoes] cleanup avaliacao ${avaliacaoId} falhou: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
    if (token && pacienteId) {
      try {
        const response = await requestDelete(`/pacientes/${pacienteId}`, token);
        if (!response.ok && response.status !== 404) {
          console.warn(`[e2e-avaliacoes] cleanup paciente ${pacienteId} retornou HTTP ${response.status}`);
        }
      } catch (error) {
        console.warn(`[e2e-avaliacoes] cleanup paciente ${pacienteId} falhou: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }
};

run().catch((error) => {
  console.error(`[e2e-avaliacoes] Falha: ${error.message}`);
  process.exitCode = 1;
});
