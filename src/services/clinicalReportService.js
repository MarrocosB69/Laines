import {
  getEvaluationStatusLabel,
  getEvaluationTypeLabel
} from '../components/shared/evaluationSummaryUtils';

export const REPORT_SCHEMA_VERSION = '1.0.0';

const REPORT_METRIC_LABELS = {
  percentual_gordura: '% Gordura',
  massa_gorda: 'Massa gorda',
  massa_magra: 'Massa magra',
  tmb_cunningham: 'TMB Cunningham',
  classificacao_imc: 'Classificacao IMC',
  pressao_sistolica: 'PA sistolica',
  pressao_diastolica: 'PA diastolica',
  frequencia_cardiaca: 'Frequencia cardiaca',
  glicemia_capilar: 'Glicemia capilar',
  pressao_arterial_media: 'Pressao arterial media',
  classificacao_pressao_arterial: 'Classificacao da pressao arterial',
  prioridade_cuidado: 'Prioridade de cuidado',
  total_diario: 'Total diario',
  pontuacao_ebia: 'Pontuacao EBIA',
  perda_peso_percentual: 'Perda de peso (%)',
  taxa_sudorese_lh: 'Taxa de sudorese (L/h)',
  intensidade_dor: 'Intensidade de dor',
  humor_atual: 'Humor atual'
};

const REPORT_IGNORED_KEYS = new Set([
  'id',
  'ids',
  'sessaoid',
  'pacienteid',
  'projetoid',
  'projetonome',
  'schema',
  'schema_version',
  'autosave',
  'input',
  'source',
  'createdat',
  'updatedat',
  'measuredat'
]);

export function buildClinicalReportModel({
  patient,
  patientId,
  user,
  activeModule,
  moduleStates,
  progress,
  sortedHistory,
  baseline,
  getRecordDate,
  formatDate
}) {
  const generatedAt = new Date();
  const historyRows = Array.isArray(sortedHistory) ? sortedHistory : [];
  const moduleRows = Array.isArray(moduleStates) ? moduleStates : [];

  const modules = moduleRows.map((module, index) => {
    const snapshot = module?.snapshot || null;
    const updatedAt = toDateObject(snapshot ? getRecordDate(snapshot) : module?.updatedAt);
    const moduleStatus = String(module?.status || 'pendente').toLowerCase();
    return {
      order: index + 1,
      id: module?.id || '',
      tipo: module?.tipo || '',
      grupo: module?.group || '',
      titulo: module?.label || 'Modulo',
      status: moduleStatus,
      statusLabel: getEvaluationStatusLabel(moduleStatus),
      completude: Number.isFinite(module?.completion) ? module.completion : 0,
      descricao: module?.description || '',
      atualizadoEm: updatedAt ? updatedAt.toISOString() : null,
      atualizadoEmLabel: updatedAt ? formatDate(updatedAt) : 'Nao informado',
      responsavel: snapshot?.createdByName || snapshot?.alunoNome || 'Nao informado',
      formulaId: snapshot?.formulaId || '',
      formulaVersion: snapshot?.formulaVersion || '',
      destaques: buildModuleHighlights(snapshot, 6)
    };
  });

  const history = historyRows.map((item) => {
    const status = String(item?.status || 'pendente').toLowerCase();
    const recordDate = toDateObject(getRecordDate(item));
    return {
      id: item?.id || '',
      tipo: String(item?.tipo || ''),
      tipoLabel: getEvaluationTypeLabel(item?.tipo),
      status,
      statusLabel: getEvaluationStatusLabel(status),
      responsavel: item?.createdByName || item?.alunoNome || 'Nao informado',
      data: recordDate ? recordDate.toISOString() : null,
      dataLabel: recordDate ? formatDate(recordDate) : 'Nao informada',
      formulaId: item?.formulaId || '',
      formulaVersion: item?.formulaVersion || ''
    };
  });

  const activeStatus = String(activeModule?.status || 'pendente').toLowerCase();
  const activeSnapshot = activeModule?.snapshot || null;
  const activeUpdatedAt = toDateObject(activeSnapshot ? getRecordDate(activeSnapshot) : null);
  const formulaCatalog = Array.from(
    new Set(
      history
        .filter((item) => item.formulaId)
        .map((item) => `${item.formulaId}${item.formulaVersion ? `@${item.formulaVersion}` : ''}`)
    )
  );

  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    generatedAt: generatedAt.toISOString(),
    generatedAtLabel: formatDateTimeShort(generatedAt),
    exportedBy: {
      nome: user?.name || user?.nome || user?.email || 'Equipe LAINES',
      email: user?.email || '',
      perfil: resolveUserRoleLabel(user)
    },
    patient: {
      id: patient?.id || patientId || '',
      nome: patient?.nome || patientId || 'Paciente',
      projeto: patient?.projetoNome || 'Nao vinculado'
    },
    overview: {
      status: String(progress?.overallStatus || 'pendente'),
      statusLabel: progress?.overallStatus === 'em_analise'
        ? 'Em andamento'
        : getEvaluationStatusLabel(progress?.overallStatus || 'pendente'),
      completude: Number.isFinite(progress?.completion) ? progress.completion : 0,
      modulosTotal: Number.isFinite(progress?.total) ? progress.total : moduleRows.length,
      modulosFinalizados: Number.isFinite(progress?.finalized) ? progress.finalized : 0,
      modulosEmAndamento: Number.isFinite(progress?.inProgress) ? progress.inProgress : 0,
      modulosPendentes: Number.isFinite(progress?.pending) ? progress.pending : 0
    },
    baseline: {
      pesoKg: Number.isFinite(baseline?.pesoKg) ? Number(baseline.pesoKg) : null,
      estaturaCm: Number.isFinite(baseline?.estaturaCm) ? Number(baseline.estaturaCm) : null,
      idade: Number.isFinite(baseline?.idade) ? Number(baseline.idade) : null,
      sexo: baseline?.sexo || ''
    },
    activeModule: activeModule
      ? {
          id: activeModule.id,
          tipo: activeModule.tipo,
          titulo: activeModule.label,
          status: activeStatus,
          statusLabel: getEvaluationStatusLabel(activeStatus),
          completude: Number.isFinite(activeModule.completion) ? activeModule.completion : 0,
          atualizadoEm: activeUpdatedAt ? activeUpdatedAt.toISOString() : null,
          atualizadoEmLabel: activeUpdatedAt ? formatDate(activeUpdatedAt) : 'Nao informado',
          destaques: buildModuleHighlights(activeSnapshot, 8)
        }
      : null,
    modules,
    history,
    formulasCatalogadas: formulaCatalog
  };
}

export function buildClinicalReportHtml(model) {
  const report = model || {};
  const patient = report.patient || {};
  const overview = report.overview || {};
  const baseline = report.baseline || {};
  const activeModule = report.activeModule || null;
  const modules = Array.isArray(report.modules) ? report.modules : [];
  const history = Array.isArray(report.history) ? report.history : [];
  const formulasCatalogadas = Array.isArray(report.formulasCatalogadas) ? report.formulasCatalogadas : [];
  const historyRowsLimit = 40;

  const moduleRowsHtml = modules.map((module) => `
    <tr>
      <td>${escapeHtml(module.order)}</td>
      <td>${escapeHtml(module.grupo || '-')}</td>
      <td>${escapeHtml(module.titulo || '-')}</td>
      <td>${escapeHtml(module.statusLabel || '-')}</td>
      <td>${escapeHtml(`${module.completude ?? 0}%`)}</td>
      <td>${escapeHtml(module.responsavel || '-')}</td>
      <td>${escapeHtml(module.atualizadoEmLabel || '-')}</td>
    </tr>
  `).join('');

  const activeHighlightsHtml = activeModule?.destaques?.length
    ? activeModule.destaques.map((item) => `
      <li>
        <strong>${escapeHtml(item.label)}</strong>
        <span>${escapeHtml(item.value)}</span>
      </li>
    `).join('')
    : '<li><span>Nenhum destaque clinico disponivel.</span></li>';

  const historyRowsHtml = history.slice(0, historyRowsLimit).map((item) => `
    <tr>
      <td>${escapeHtml(item.dataLabel || '-')}</td>
      <td>${escapeHtml(item.tipoLabel || item.tipo || '-')}</td>
      <td>${escapeHtml(item.statusLabel || '-')}</td>
      <td>${escapeHtml(item.responsavel || '-')}</td>
      <td>${escapeHtml(item.formulaId || '-')}</td>
    </tr>
  `).join('');

  const formulaListHtml = formulasCatalogadas.length
    ? formulasCatalogadas.map((formula) => `<li>${escapeHtml(formula)}</li>`).join('')
    : '<li>Nenhuma formula catalogada no periodo.</li>';

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Relatorio clinico - ${escapeHtml(patient.nome || 'Paciente')}</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 28px;
      font-family: "Inter", "Segoe UI", sans-serif;
      color: #163447;
      background: #f4f9fc;
      line-height: 1.45;
    }
    h1, h2, h3, h4, p { margin: 0; }
    .report-shell {
      max-width: 1040px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #d4e7f0;
      border-radius: 18px;
      overflow: hidden;
      box-shadow: 0 16px 36px rgba(11, 42, 61, 0.08);
    }
    .report-header {
      padding: 22px 24px;
      border-bottom: 1px solid #d4e7f0;
      background: linear-gradient(135deg, #f7fcfe, #e9f5fb);
      display: grid;
      gap: 14px;
    }
    .report-header-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 10px;
      flex-wrap: wrap;
    }
    .report-tag {
      font-size: 11px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #497085;
      font-weight: 700;
    }
    .report-title {
      font-size: 25px;
      color: #123146;
      font-weight: 800;
      letter-spacing: -0.01em;
      margin-top: 4px;
    }
    .report-generated {
      text-align: right;
      font-size: 12px;
      color: #47697c;
      font-weight: 600;
    }
    .report-patient-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 8px 12px;
    }
    .patient-item {
      border: 1px solid #d9e9f2;
      border-radius: 11px;
      padding: 8px 10px;
      background: #ffffff;
    }
    .patient-item small {
      display: block;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #5d7d8f;
      font-weight: 700;
      margin-bottom: 3px;
    }
    .patient-item strong {
      font-size: 13px;
      color: #14374c;
      font-weight: 700;
    }
    .section {
      padding: 20px 24px;
      border-bottom: 1px solid #edf4f8;
    }
    .section:last-child { border-bottom: none; }
    .section-title {
      font-size: 13px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #436879;
      margin-bottom: 12px;
      font-weight: 800;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 8px;
    }
    .summary-item {
      border: 1px solid #d9e9f2;
      border-radius: 11px;
      padding: 8px 10px;
      background: #fafdff;
    }
    .summary-item small {
      display: block;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #5c7a8c;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .summary-item strong {
      color: #123146;
      font-size: 14px;
      font-weight: 800;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      border: 1px solid #d9e9f2;
      border-radius: 12px;
      overflow: hidden;
    }
    thead th {
      text-align: left;
      font-size: 10px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #557588;
      background: #eef6fa;
      padding: 9px 10px;
      border-bottom: 1px solid #d9e9f2;
      font-weight: 800;
    }
    tbody td {
      padding: 8px 10px;
      border-bottom: 1px solid #edf4f8;
      color: #1e445a;
      vertical-align: top;
    }
    tbody tr:last-child td { border-bottom: none; }
    .active-module-box {
      border: 1px solid #d9e9f2;
      border-radius: 12px;
      background: #fafdff;
      padding: 10px 12px;
      margin-bottom: 10px;
      display: grid;
      gap: 8px;
    }
    .active-module-box p {
      font-size: 12px;
      color: #305469;
    }
    .active-module-box strong {
      color: #123146;
    }
    .highlight-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      gap: 8px;
    }
    .highlight-list li {
      border: 1px solid #d9e9f2;
      border-radius: 10px;
      padding: 8px 9px;
      display: grid;
      gap: 4px;
      background: #ffffff;
    }
    .highlight-list strong {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #5f7e90;
    }
    .highlight-list span {
      font-size: 12px;
      color: #183f54;
      font-weight: 700;
    }
    .formula-list {
      margin: 0;
      padding-left: 18px;
      display: grid;
      gap: 5px;
      color: #244a5f;
      font-size: 12px;
    }
    .report-footnote {
      margin-top: 10px;
      color: #56778a;
      font-size: 11px;
    }
    @media print {
      body { background: #ffffff; padding: 0; }
      .report-shell { border: none; box-shadow: none; border-radius: 0; }
    }
  </style>
</head>
<body>
  <main class="report-shell">
    <header class="report-header">
      <div class="report-header-top">
        <div>
          <span class="report-tag">LAINES - Relatorio Clinico Estruturado</span>
          <h1 class="report-title">Relatorio de Avaliacoes</h1>
        </div>
        <div class="report-generated">
          <div>Gerado em: ${escapeHtml(report.generatedAtLabel || 'Nao informado')}</div>
          <div>Responsavel pela exportacao: ${escapeHtml(report.exportedBy?.nome || 'Nao informado')}</div>
          <div>Perfil: ${escapeHtml(report.exportedBy?.perfil || 'Nao informado')}</div>
        </div>
      </div>
      <div class="report-patient-grid">
        <div class="patient-item"><small>Paciente</small><strong>${escapeHtml(patient.nome || 'Nao informado')}</strong></div>
        <div class="patient-item"><small>ID</small><strong>${escapeHtml(patient.id || '-')}</strong></div>
        <div class="patient-item"><small>Projeto</small><strong>${escapeHtml(patient.projeto || 'Nao vinculado')}</strong></div>
        <div class="patient-item"><small>Versao do modelo</small><strong>${escapeHtml(report.schemaVersion || REPORT_SCHEMA_VERSION)}</strong></div>
      </div>
    </header>

    <section class="section">
      <h2 class="section-title">Resumo Executivo</h2>
      <div class="summary-grid">
        <div class="summary-item"><small>Status geral</small><strong>${escapeHtml(overview.statusLabel || '-')}</strong></div>
        <div class="summary-item"><small>Completude total</small><strong>${escapeHtml(`${overview.completude ?? 0}%`)}</strong></div>
        <div class="summary-item"><small>Modulos finalizados</small><strong>${escapeHtml(`${overview.modulosFinalizados ?? 0}/${overview.modulosTotal ?? 0}`)}</strong></div>
        <div class="summary-item"><small>Em andamento</small><strong>${escapeHtml(String(overview.modulosEmAndamento ?? 0))}</strong></div>
        <div class="summary-item"><small>Pendentes</small><strong>${escapeHtml(String(overview.modulosPendentes ?? 0))}</strong></div>
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">Ficha Base Compartilhada</h2>
      <div class="summary-grid">
        <div class="summary-item"><small>Peso</small><strong>${escapeHtml(formatNumberWithUnit(baseline.pesoKg, 'kg'))}</strong></div>
        <div class="summary-item"><small>Estatura</small><strong>${escapeHtml(formatNumberWithUnit(baseline.estaturaCm, 'cm'))}</strong></div>
        <div class="summary-item"><small>Idade</small><strong>${escapeHtml(formatNumberWithUnit(baseline.idade, 'anos', 0))}</strong></div>
        <div class="summary-item"><small>Sexo biologico</small><strong>${escapeHtml(baseline.sexo || 'Nao informado')}</strong></div>
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">Status Dos Modulos</h2>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Grupo</th>
            <th>Modulo</th>
            <th>Status</th>
            <th>Completude</th>
            <th>Responsavel</th>
            <th>Atualizacao</th>
          </tr>
        </thead>
        <tbody>
          ${moduleRowsHtml || '<tr><td colspan="7">Nenhum modulo registrado.</td></tr>'}
        </tbody>
      </table>
    </section>

    <section class="section">
      <h2 class="section-title">Modulo Ativo Na Exportacao</h2>
      ${activeModule ? `
        <div class="active-module-box">
          <p><strong>Modulo:</strong> ${escapeHtml(activeModule.titulo || '-')} (${escapeHtml(getEvaluationTypeLabel(activeModule.tipo || ''))})</p>
          <p><strong>Status:</strong> ${escapeHtml(activeModule.statusLabel || '-')} | <strong>Completude:</strong> ${escapeHtml(`${activeModule.completude ?? 0}%`)}</p>
          <p><strong>Ultima atualizacao:</strong> ${escapeHtml(activeModule.atualizadoEmLabel || 'Nao informado')}</p>
        </div>
        <ul class="highlight-list">${activeHighlightsHtml}</ul>
      ` : '<p>Nenhum modulo ativo identificado no momento da exportacao.</p>'}
    </section>

    <section class="section">
      <h2 class="section-title">Historico Consolidado</h2>
      <table>
        <thead>
          <tr>
            <th>Data</th>
            <th>Tipo</th>
            <th>Status</th>
            <th>Responsavel</th>
            <th>Formula</th>
          </tr>
        </thead>
        <tbody>
          ${historyRowsHtml || '<tr><td colspan="5">Nenhum registro no historico.</td></tr>'}
        </tbody>
      </table>
      <p class="report-footnote">
        ${history.length > historyRowsLimit
    ? `Historico limitado aos ${historyRowsLimit} registros mais recentes nesta versao.`
    : `Total de registros listados: ${history.length}.`}
      </p>
    </section>

    <section class="section">
      <h2 class="section-title">Catalogo De Formulas Aplicadas</h2>
      <ul class="formula-list">${formulaListHtml}</ul>
    </section>
  </main>
</body>
</html>`;
}

export function buildReportFilename(nameOrId, extension = 'html') {
  const safeSlug = slugifyFilename(nameOrId || 'paciente');
  const stamp = new Date().toISOString().slice(0, 10);
  return `relatorio-clinico-${safeSlug}-${stamp}.${extension}`;
}

export function downloadTextFile(content, filename, mimeType = 'text/plain;charset=utf-8;') {
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  window.URL.revokeObjectURL(url);
}

function buildModuleHighlights(snapshot, limit = 8) {
  if (!snapshot || typeof snapshot !== 'object') return [];
  const accumulator = [];
  const seen = new Set();
  const sources = [
    snapshot?.resultados?.calculated,
    snapshot?.resultados?.output,
    snapshot?.resultados,
    snapshot?.dados
  ];

  sources.forEach((source) => {
    if (accumulator.length >= limit) return;
    const entries = collectPrimitiveEntries(source, { maxDepth: 2, maxItems: 30 });
    entries.forEach((entry) => {
      if (accumulator.length >= limit) return;
      const entryKey = String(entry.key || '').split('.').pop().toLowerCase();
      if (!entryKey || seen.has(entryKey) || shouldIgnoreReportField(entryKey, entry.value)) return;
      seen.add(entryKey);
      accumulator.push({
        label: formatReportMetricLabel(entry.key),
        value: formatReportValue(entry.value)
      });
    });
  });

  return accumulator;
}

function collectPrimitiveEntries(
  source,
  {
    prefix = '',
    depth = 0,
    maxDepth = 2,
    maxItems = 30,
    accumulator = []
  } = {}
) {
  if (!source || typeof source !== 'object') return accumulator;
  if (depth > maxDepth || accumulator.length >= maxItems) return accumulator;

  Object.entries(source).forEach(([key, value]) => {
    if (accumulator.length >= maxItems) return;
    const path = prefix ? `${prefix}.${key}` : key;

    if (shouldIgnoreReportField(path, value)) return;

    if (Array.isArray(value)) {
      if (!value.length) return;
      const primitiveOnly = value.every((item) => item === null || ['string', 'number', 'boolean'].includes(typeof item));
      if (primitiveOnly) {
        accumulator.push({ key: path, value: value.map((item) => formatReportValue(item)).join(', ') });
      }
      return;
    }

    if (value && typeof value === 'object') {
      collectPrimitiveEntries(value, {
        prefix: path,
        depth: depth + 1,
        maxDepth,
        maxItems,
        accumulator
      });
      return;
    }

    accumulator.push({ key: path, value });
  });

  return accumulator;
}

function shouldIgnoreReportField(path, value) {
  if (value === null || value === undefined || value === '') return true;
  const token = String(path || '').toLowerCase();
  const normalized = token.replace(/[^a-z0-9]+/g, '');
  const tail = token.split('.').pop()?.replace(/[^a-z0-9]+/g, '') || '';
  return REPORT_IGNORED_KEYS.has(normalized) || REPORT_IGNORED_KEYS.has(tail);
}

function formatReportMetricLabel(path = '') {
  const rawToken = String(path || '').split('.').pop() || String(path || '');
  const normalized = rawToken
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .toLowerCase()
    .replace(/^_+|_+$/g, '');

  if (REPORT_METRIC_LABELS[normalized]) return REPORT_METRIC_LABELS[normalized];

  return normalized
    .split('_')
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ') || rawToken;
}

function formatReportValue(value) {
  if (value === null || value === undefined || value === '') return 'Nao informado';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  }
  if (typeof value === 'boolean') return value ? 'Sim' : 'Nao';
  if (value instanceof Date) return formatDateTimeShort(value);
  return String(value).trim() || 'Nao informado';
}

function resolveUserRoleLabel(user) {
  if (Array.isArray(user?.roles) && user.roles.length) return user.roles.join(', ');
  return String(user?.role || user?.perfil || user?.tipo || user?.cargo || 'Nao informado');
}

function toDateObject(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value?.toDate === 'function') {
    const converted = value.toDate();
    return Number.isNaN(converted?.getTime?.()) ? null : converted;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateTimeShort(value) {
  const date = toDateObject(value);
  if (!date) return 'Nao informado';
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatNumberWithUnit(value, unit = '', digits = 1) {
  if (!Number.isFinite(value)) return 'Nao informado';
  const formatted = Number(value).toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
  return unit ? `${formatted} ${unit}` : formatted;
}

function escapeHtml(value) {
  const text = String(value ?? '');
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function slugifyFilename(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'paciente';
}

