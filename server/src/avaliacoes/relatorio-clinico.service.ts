import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Avaliacao } from './avaliacao.entity';
import { Paciente } from '../pacientes/paciente.entity';
import { AuthenticatedUser, hasGlobalAccess, hasTeamScopedAccess, isStudentMemberRole, normalizeRole } from '../auth/access-control';

type JsonRecord = Record<string, unknown>;

const asRec = (v: unknown): JsonRecord =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as JsonRecord) : {};

const toStr = (v: unknown, fallback = '-'): string => {
  const s = String(v ?? '').trim();
  return s || fallback;
};

const toNum = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const fmt = (v: number | null | undefined, dec = 1, unit = ''): string => {
  if (!Number.isFinite(v) || v === null || v === undefined) return '-';
  return `${v.toFixed(dec)}${unit}`;
};

const fmtDate = (v: unknown): string => {
  if (!v) return '-';
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('pt-BR');
};

// ── Extract helpers per evaluation type ───────────────────────────────────

function extractAnamnese(av: Avaliacao): string[] {
  const d = asRec(av.dados);
  const i = asRec(d.input);
  const lines: string[] = [];
  const obj = toStr(d.objetivo || i.objetivo, '');
  if (obj) lines.push(`Objetivo: ${obj}`);
  const hist = toStr(d.historicoClinnico || d.historico || i.historico || i.historicoClinnico, '');
  if (hist) lines.push(`Histórico: ${hist}`);
  const mod = toStr(d.modalidade || i.modalidade, '');
  if (mod) lines.push(`Modalidade: ${mod}`);
  return lines;
}

function extractClinica(av: Avaliacao): string[] {
  const d = asRec(av.dados);
  const i = asRec(d.input);
  const lines: string[] = [];
  const pas = toNum(d.pressaoSistolica ?? i.pressaoSistolica ?? d.pas ?? i.pas);
  const pad = toNum(d.pressaoDiastolica ?? i.pressaoDiastolica ?? d.pad ?? i.pad);
  const fc = toNum(d.frequenciaCardiaca ?? i.frequenciaCardiaca ?? d.fc ?? i.fc);
  if (pas !== null && pad !== null) lines.push(`PA: ${pas}/${pad} mmHg`);
  if (fc !== null) lines.push(`FC repouso: ${fc} bpm`);
  const peso = toNum(d.peso ?? i.peso ?? d.massaCorporal ?? i.massaCorporal);
  const alt = toNum(d.altura ?? i.altura ?? d.estatura ?? i.estatura);
  if (peso !== null) lines.push(`Peso: ${fmt(peso)} kg`);
  if (alt !== null) lines.push(`Estatura: ${fmt(alt)} cm`);
  return lines;
}

function extractComposicao(av: Avaliacao): string[] {
  const d = asRec(av.dados);
  const res = asRec(av.resultados);
  const calc = asRec(res.calculated ?? d.resultados_calculados);
  const lines: string[] = [];
  const pctGord = toNum(calc.percentualGordura ?? calc.percentualGorduraOficial ?? d.percentualGordura);
  const massaMagra = toNum(calc.massaMagra ?? calc.massaMagraKg ?? d.massaMagra);
  const massaGorda = toNum(calc.massaGorda ?? calc.massaGordaKg ?? d.massaGorda);
  if (pctGord !== null) lines.push(`%G: ${fmt(pctGord)}%`);
  if (massaMagra !== null) lines.push(`Massa magra: ${fmt(massaMagra)} kg`);
  if (massaGorda !== null) lines.push(`Massa gorda: ${fmt(massaGorda)} kg`);
  const protocolo = toStr(d.protocolo ?? d.protocoloSelecionado ?? calc.protocolo, '');
  if (protocolo) lines.push(`Protocolo: ${protocolo}`);
  return lines;
}

function extractGet(av: Avaliacao): string[] {
  const d = asRec(av.dados);
  const i = asRec(d.input);
  const res = asRec(av.resultados);
  const calc = asRec(res.calculated ?? d.resultados_calculados);
  const lines: string[] = [];
  const getVal = toNum(calc.getEstimadoKcal ?? calc.getKcal ?? d.getEstimadoKcal ?? i.getEstimadoKcal);
  const tmb = toNum(calc.tmbKcal ?? calc.tmb ?? d.tmbKcal ?? i.tmbKcal);
  if (getVal !== null) lines.push(`GET: ${fmt(getVal, 0)} kcal/dia`);
  if (tmb !== null) lines.push(`TMB: ${fmt(tmb, 0)} kcal/dia`);
  const faf = toStr(d.fatorAtividade ?? i.fatorAtividade ?? calc.fatorAtividade, '');
  if (faf) lines.push(`Fator atividade: ${faf}`);
  return lines;
}

function extractReds(av: Avaliacao): string[] {
  const d = asRec(av.dados);
  const res = asRec(av.resultados);
  const out = asRec(res.output ?? res.calculated);
  const lines: string[] = [];
  const clas = toStr(d.classificacaoDE ?? out.classificacaoDE ?? av.classificacao, '');
  if (clas) lines.push(`Classificação DE: ${clas}`);
  const leafScore = toNum(d.leafqScore ?? d.leafScore ?? out.leafqScore);
  if (leafScore !== null) lines.push(`LEAF-Q: ${leafScore}`);
  const redsCat = toStr(d.redsCatClassificacao ?? out.redsCatClassificacao, '');
  if (redsCat) lines.push(`RED-S CAT: ${redsCat}`);
  return lines;
}

function extractLab(av: Avaliacao): { nome: string; valor: string; status: string }[] {
  const d = asRec(av.dados);
  const analitos = Array.isArray(d.analitos)
    ? d.analitos
    : Array.isArray(asRec(d.dados_brutos).analitos)
      ? asRec(d.dados_brutos).analitos as unknown[]
      : [];
  return analitos.slice(0, 20).map((item) => {
    const a = asRec(item);
    return {
      nome: toStr(a.nome, '?'),
      valor: `${toStr(a.valor, '-')} ${toStr(a.unidade, '')}`.trim(),
      status: toStr(a.status ?? a.classificacao, '-'),
    };
  });
}

function extractPsicologia(av: Avaliacao): string[] {
  const d = asRec(av.dados);
  const i = asRec(d.input);
  const lines: string[] = [];
  const phq9 = toNum(d.phq9Score ?? i.phq9Score);
  const phq9Sev = toStr(d.phq9Severity ?? i.phq9Severity, '');
  const gad7 = toNum(d.gad7Score ?? i.gad7Score);
  const gad7Sev = toStr(d.gad7Severity ?? i.gad7Severity, '');
  if (phq9 !== null) lines.push(`PHQ-9: ${phq9}/27 — ${phq9Sev || 'sem classificação'}`);
  if (gad7 !== null) lines.push(`GAD-7: ${gad7}/21 — ${gad7Sev || 'sem classificação'}`);
  const stress = toNum(d.estresse ?? i.estresse);
  if (stress !== null) lines.push(`Nível de estresse: ${stress}/10`);
  const obs = toStr(d.observacoes ?? i.observacoes, '');
  if (obs) lines.push(`Obs: ${obs.slice(0, 200)}`);
  return lines;
}

function extractEvolucao(av: Avaliacao): string[] {
  const d = asRec(av.dados);
  const brutos = asRec(d.dados_brutos);
  const calc = asRec(asRec(av.resultados).calculated);
  const lines: string[] = [];
  const score = toNum(calc.scoreAdesaoGeral ?? av.resultados?.score_adesao_geral as unknown);
  if (score !== null) lines.push(`Score de adesão geral: ${fmt(score, 0)}%`);
  const adeAlim = toNum(brutos.adesaoPlanoAlimentar);
  const adeAF = toNum(brutos.adesaoAtividadeFisica);
  if (adeAlim !== null) lines.push(`Adesão alimentar: ${adeAlim}%`);
  if (adeAF !== null) lines.push(`Adesão AF: ${adeAF}%`);
  const conduta = toStr(brutos.conduta ?? asRec(d.input).conduta, '');
  if (conduta) lines.push(`Conduta: ${conduta.slice(0, 300)}`);
  const prox = toStr(brutos.proximaAvaliacao ?? asRec(d.input).proximaAvaliacao, '');
  if (prox) lines.push(`Próxima avaliação: ${fmtDate(prox)}`);
  return lines;
}

// ── Service ────────────────────────────────────────────────────────────────

const TIPO_ORDER = [
  'anamnese_inicial',
  'avaliacao_clinica',
  'perimetros',
  'dobras_cutaneas',
  'bioimpedancia',
  'composicao_corporal_integrada',
  'gasto_energetico_total',
  'triagem_reds',
  'exames_laboratoriais',
  'psicologia',
  'fisioterapia',
  'alimentar',
  'hidratacao',
  'carga_treino',
  'evolucao_retorno',
];

const TIPO_LABEL: Record<string, string> = {
  anamnese_inicial: 'Anamnese inicial',
  avaliacao_clinica: 'Avaliação clínica',
  perimetros: 'Perímetros corporais',
  dobras_cutaneas: 'Dobras cutâneas',
  bioimpedancia: 'Bioimpedância',
  composicao_corporal_integrada: 'Composição corporal',
  gasto_energetico_total: 'Gasto energético total',
  triagem_reds: 'Triagem RED-S',
  exames_laboratoriais: 'Exames laboratoriais',
  psicologia: 'Psicologia',
  fisioterapia: 'Fisioterapia',
  alimentar: 'Avaliação alimentar',
  hidratacao: 'Hidratação',
  carga_treino: 'Carga de treino',
  evolucao_retorno: 'Evolução e retorno',
};

@Injectable()
export class RelatorioClinicoService {
  constructor(
    @InjectRepository(Avaliacao) private avaliacoesRepo: Repository<Avaliacao>,
    @InjectRepository(Paciente) private pacientesRepo: Repository<Paciente>,
  ) {}

  private canAccess(user: AuthenticatedUser, paciente: Paciente): boolean {
    const role = normalizeRole(user.role);
    if (hasGlobalAccess(role)) return true;
    if (hasTeamScopedAccess(role)) {
      return paciente.professorSupervisorId === user.id
        || paciente.alunoResponsavelId === user.id
        || (paciente.equipeTecnicaIds || []).includes(user.id);
    }
    if (isStudentMemberRole(role)) {
      return paciente.alunoResponsavelId === user.id
        || (paciente.equipeTecnicaIds || []).includes(user.id);
    }
    if (role === 'atleta') return paciente.atletaUserId === user.id;
    return false;
  }

  async gerarPDF(pacienteId: string, user: AuthenticatedUser): Promise<Buffer> {
    const paciente = await this.pacientesRepo.findOne({ where: { id: pacienteId } });
    if (!paciente) throw new NotFoundException('Paciente nao encontrado.');
    if (!this.canAccess(user, paciente)) throw new NotFoundException('Paciente nao encontrado.');

    const avaliacoes = await this.avaliacoesRepo.find({
      where: { pacienteId, status: 'finalizada' },
      order: { createdAt: 'ASC' },
    });

    let PDFDocument: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      PDFDocument = require('pdfkit');
    } catch {
      throw new BadRequestException('Dependencia pdfkit nao instalada no servidor.');
    }

    // Group by tipo, keep latest of each
    const byTipo = new Map<string, Avaliacao>();
    for (const av of avaliacoes) {
      const tipo = String(av.tipo || '').toLowerCase().replace(/-/g, '_');
      byTipo.set(tipo, av); // último prevalece (ordem ASC → último = mais recente)
    }

    const geradoEm = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({ margin: 36, size: 'A4' });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const PL = doc.page.margins.left;
      const PR = doc.page.width - doc.page.margins.right;
      const PB = doc.page.height - doc.page.margins.bottom;
      const CW = PR - PL;

      const ensureSpace = (needed = 30) => {
        if (doc.y + needed > PB) doc.addPage();
      };

      const sectionTitle = (title: string) => {
        ensureSpace(36);
        doc.moveDown(0.5);
        doc.rect(PL, doc.y, CW, 20).fill('#1565C0');
        doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10)
          .text(title, PL + 8, doc.y - 15, { width: CW - 16 });
        doc.fillColor('#111827').font('Helvetica').fontSize(9.5);
        doc.y = doc.y + 8;
        doc.moveDown(0.3);
      };

      const line = (text: string, indent = 0) => {
        ensureSpace(15);
        doc.font('Helvetica').fontSize(9.5).fillColor('#111827')
          .text(text, PL + indent, doc.y, { width: CW - indent });
      };

      const kv = (label: string, value: string) => {
        ensureSpace(14);
        const y = doc.y;
        doc.font('Helvetica-Bold').fontSize(9).fillColor('#374151')
          .text(`${label}:`, PL, y, { continued: true, width: 160 });
        doc.font('Helvetica').fontSize(9).fillColor('#111827')
          .text(` ${value}`, { width: CW - 160 });
      };

      const labRow = (nome: string, valor: string, status: string, shade: boolean) => {
        ensureSpace(18);
        const y = doc.y;
        const rowH = 16;
        if (shade) doc.rect(PL, y, CW, rowH).fill('#f8fafc');
        const statusColor = status.includes('alterado') ? '#dc2626'
          : status.includes('limitrofe') ? '#d97706' : '#374151';
        doc.font('Helvetica').fontSize(8.5).fillColor('#111827')
          .text(nome, PL + 4, y + 4, { lineBreak: false });
        doc.text(valor, PL + 220, y + 4, { lineBreak: false });
        doc.fillColor(statusColor).text(status, PL + 340, y + 4);
        doc.y = y + rowH;
      };

      // ── Header ──────────────────────────────────────────────────────────
      const headerY = doc.y;
      doc.rect(PL, headerY, CW, 60).fill('#1565C0');
      doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(16)
        .text('LAINES | Relatório Clínico do Atleta', PL + 12, headerY + 10, { width: CW - 24 });
      doc.font('Helvetica').fontSize(8.5)
        .text(`Gerado em ${geradoEm}  |  Documento confidencial — uso clínico e formativo`, PL + 12, headerY + 36, { width: CW - 24 });
      doc.fillColor('#111827');
      doc.y = headerY + 72;

      // ── Identificação ────────────────────────────────────────────────────
      sectionTitle('Identificação do atleta');
      kv('Nome', toStr(paciente.nome));
      kv('Prontuário', toStr(paciente.prontuario));
      kv('CPF', toStr(paciente.cpf));
      kv('Modalidade', toStr(paciente.modalidadePrincipal));
      kv('Membro responsável', toStr(paciente.alunoResponsavelNome));
      kv('Professor orientador', toStr(paciente.professorSupervisorNome));
      kv('Total de avaliações', String(avaliacoes.length));
      doc.moveDown(0.3);

      // ── Seções por tipo ─────────────────────────────────────────────────
      const orderedTipos = [
        ...TIPO_ORDER.filter((t) => byTipo.has(t)),
        ...[...byTipo.keys()].filter((t) => !TIPO_ORDER.includes(t)),
      ];

      for (const tipo of orderedTipos) {
        const av = byTipo.get(tipo)!;
        const label = TIPO_LABEL[tipo] || tipo.replace(/_/g, ' ');
        const dateLabel = fmtDate(av.data || av.createdAt);

        sectionTitle(`${label}  —  ${dateLabel}`);

        if (tipo === 'anamnese_inicial') {
          extractAnamnese(av).forEach((l) => line(l));
        } else if (tipo === 'avaliacao_clinica') {
          extractClinica(av).forEach((l) => line(l));
        } else if (tipo === 'composicao_corporal_integrada') {
          extractComposicao(av).forEach((l) => line(l));
        } else if (tipo === 'gasto_energetico_total') {
          extractGet(av).forEach((l) => line(l));
        } else if (tipo === 'triagem_reds') {
          extractReds(av).forEach((l) => line(l));
        } else if (tipo === 'exames_laboratoriais') {
          const rows = extractLab(av);
          if (rows.length) {
            ensureSpace(22);
            const hY = doc.y;
            doc.rect(PL, hY, CW, 16).fill('#e2e8f0');
            doc.fillColor('#374151').font('Helvetica-Bold').fontSize(8.5)
              .text('Analito', PL + 4, hY + 4, { lineBreak: false });
            doc.text('Valor', PL + 220, hY + 4, { lineBreak: false });
            doc.text('Status', PL + 340, hY + 4);
            doc.y = hY + 16;
            rows.forEach((r, i) => labRow(r.nome, r.valor, r.status, i % 2 === 0));
          }
        } else if (tipo === 'psicologia') {
          extractPsicologia(av).forEach((l) => line(l));
        } else if (tipo === 'evolucao_retorno') {
          extractEvolucao(av).forEach((l) => line(l));
        } else {
          // Fallback genérico: classificação + warnings
          const clas = toStr(av.classificacao ?? av.classificacaoLabel, '');
          if (clas) line(`Classificação: ${clas}`);
          const warns = Array.isArray(av.resultados?.warnings) ? av.resultados!.warnings as string[] : [];
          warns.slice(0, 3).forEach((w) => line(`• ${w}`, 8));
        }

        doc.moveDown(0.2);
      }

      // ── Assinatura ──────────────────────────────────────────────────────
      ensureSpace(70);
      doc.moveDown(1.5);
      const sigY = doc.y;
      doc.moveTo(PL, sigY).lineTo(PL + CW / 2 - 20, sigY).lineWidth(0.5).strokeColor('#9ca3af').stroke();
      doc.font('Helvetica').fontSize(8).fillColor('#6b7280')
        .text('Assinatura do responsável pela avaliação', PL, sigY + 4, { width: CW / 2 });

      doc.end();
    });
  }
}
