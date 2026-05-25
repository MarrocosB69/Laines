import { Injectable } from '@nestjs/common';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { Avaliacao } from './avaliacao.entity';

type PacienteCtx = {
  nome?: string;
  alunoResponsavelId?: string | null;
  professorSupervisorNome?: string | null;
};

type JsonRecord = Record<string, unknown>;

const asRecord = (v: unknown): JsonRecord =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as JsonRecord) : {};

const toNum = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const SUPERVISOR_ROLES = ['professor', 'coordenador', 'coord_atendimento'];

// ── RED-S risk tokens that warrant an alert ────────────────────────────────

const REDS_RISK_TOKENS = new Set([
  'alto_risco', 'risco_alto', 'alto risco', 'high_risk',
  'moderado', 'moderado_risco', 'risco_moderado', 'moderate',
  'clinico', 'clinico_sub', 'sub_clinico', 'subclinical',
]);

function isRedsRisk(classificacao: unknown): boolean {
  if (!classificacao) return false;
  const token = String(classificacao).toLowerCase().trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_');
  return REDS_RISK_TOKENS.has(token) || token.includes('risco') || token.includes('risk');
}

// ── Extract classification/score from stored evaluation data ──────────────

function extractRedsClassificacao(avaliacao: Avaliacao): string | null {
  const dados = asRecord(avaliacao.dados);
  const resultados = asRecord(avaliacao.resultados);
  const output = asRecord(resultados.output);
  const candidates = [
    dados.classificacaoDE,
    output.classificacaoDE,
    resultados.classificacaoDE,
    avaliacao.classificacao,
  ];
  for (const c of candidates) {
    if (c && String(c).trim()) return String(c).trim();
  }
  return null;
}

function extractLabScores(avaliacao: Avaliacao): {
  scoreRisco: number | null;
  alteracoesCount: number | null;
} {
  const resultados = asRecord(avaliacao.resultados);
  const calculated = asRecord(resultados.calculated);
  const dados = asRecord(avaliacao.dados);
  const resultadosCalculados = asRecord(dados.resultados_calculados);
  return {
    scoreRisco: toNum(calculated.scoreRisco ?? resultadosCalculados.scoreRisco),
    alteracoesCount: toNum(calculated.alteracoesCount ?? resultadosCalculados.alteracoesCount),
  };
}

function extractPsicologiaFlags(avaliacao: Avaliacao): {
  phq9AboveCutOff: boolean;
  gad7AboveCutOff: boolean;
  phq9Score: number | null;
  gad7Score: number | null;
} {
  const dados = asRecord(avaliacao.dados);
  const input = asRecord(dados.input);
  return {
    phq9AboveCutOff: Boolean(dados.phq9AboveCutOff ?? input.phq9AboveCutOff),
    gad7AboveCutOff: Boolean(dados.gad7AboveCutOff ?? input.gad7AboveCutOff),
    phq9Score: toNum(dados.phq9Score ?? input.phq9Score),
    gad7Score: toNum(dados.gad7Score ?? input.gad7Score),
  };
}

// ── Service ────────────────────────────────────────────────────────────────

@Injectable()
export class ClinicalAlertsService {
  constructor(private readonly notificacoes: NotificacoesService) {}

  async dispatch(avaliacao: Avaliacao, paciente?: PacienteCtx): Promise<void> {
    if (String(avaliacao.status || '').toLowerCase() !== 'finalizada') return;

    const tipo = String(avaliacao.tipo || '').toLowerCase().trim();
    const atletaNome = paciente?.nome || 'Atleta sem nome';

    try {
      if (tipo === 'triagem_reds') {
        await this.handleReds(avaliacao, atletaNome);
      } else if (tipo === 'exames_laboratoriais') {
        await this.handleLab(avaliacao, atletaNome);
      } else if (tipo === 'psicologia') {
        await this.handlePsicologia(avaliacao, atletaNome);
      }
    } catch {
      // Alertas são best-effort — não interrompem o fluxo principal
    }
  }

  private async handleReds(avaliacao: Avaliacao, atletaNome: string): Promise<void> {
    const classificacao = extractRedsClassificacao(avaliacao);
    if (!classificacao || !isRedsRisk(classificacao)) return;

    const label = classificacao.replace(/_/g, ' ');
    await this.notificacoes.createForRoles(SUPERVISOR_ROLES, {
      titulo: `Triagem RED-S — risco identificado`,
      mensagem: `Atleta ${atletaNome}: triagem RED-S finalizada com classificação "${label}". Revisão clínica indicada.`,
      tipo: 'alerta_clinico',
    });
  }

  private async handleLab(avaliacao: Avaliacao, atletaNome: string): Promise<void> {
    const { scoreRisco, alteracoesCount } = extractLabScores(avaliacao);
    const hasRisk = (scoreRisco !== null && scoreRisco >= 40) || (alteracoesCount !== null && alteracoesCount > 0);
    if (!hasRisk) return;

    const parts: string[] = [];
    if (alteracoesCount !== null && alteracoesCount > 0) {
      parts.push(`${alteracoesCount} analito(s) alterado(s)`);
    }
    if (scoreRisco !== null && scoreRisco >= 40) {
      parts.push(`score de risco ${scoreRisco}%`);
    }

    await this.notificacoes.createForRoles(SUPERVISOR_ROLES, {
      titulo: `Exames laboratoriais — achados relevantes`,
      mensagem: `Atleta ${atletaNome}: exames finalizados com ${parts.join(' e ')}. Avalie antes da próxima conduta.`,
      tipo: 'alerta_clinico',
    });
  }

  private async handlePsicologia(avaliacao: Avaliacao, atletaNome: string): Promise<void> {
    const { phq9AboveCutOff, gad7AboveCutOff, phq9Score, gad7Score } = extractPsicologiaFlags(avaliacao);
    if (!phq9AboveCutOff && !gad7AboveCutOff) return;

    const parts: string[] = [];
    if (phq9AboveCutOff && phq9Score !== null) {
      parts.push(`PHQ-9 = ${phq9Score} (acima do ponto de corte)`);
    }
    if (gad7AboveCutOff && gad7Score !== null) {
      parts.push(`GAD-7 = ${gad7Score} (acima do ponto de corte)`);
    }

    await this.notificacoes.createForRoles(SUPERVISOR_ROLES, {
      titulo: `Avaliação psicológica — atenção necessária`,
      mensagem: `Atleta ${atletaNome}: ${parts.join(' e ')}. Encaminhamento ou avaliação especializada indicada.`,
      tipo: 'alerta_clinico',
    });
  }
}
