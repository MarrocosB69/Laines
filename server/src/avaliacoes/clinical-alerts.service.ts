import { Injectable } from '@nestjs/common';
import { NotificacoesService } from '../notificacoes/notificacoes.service';
import { Avaliacao } from './avaliacao.entity';

type PacienteCtx = {
  nome?: string;
  alunoResponsavelId?: string | null;
  professorSupervisorNome?: string | null;
  professorSupervisorId?: string | null;
  equipeMultiIds?: string[];
};

type JsonRecord = Record<string, unknown>;

const asRecord = (v: unknown): JsonRecord =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as JsonRecord) : {};

const toNum = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// ── Classificações de disponibilidade energética que geram alerta ──────────
// `reds_estabelecido` (DE < 30, a faixa baixa e mais grave) não contém
// "risco" e ficava sem alerta enquanto a reduzida (`risco_relativo`) gerava
// (WI-013, defeito 7). O serviço não tem severidade: as duas geram o mesmo
// alerta clínico.

const REDS_RISK_TOKENS = new Set([
  'reds_estabelecido',
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
    const recipients = [...new Set([paciente?.professorSupervisorId, ...(paciente?.equipeMultiIds || [])])]
      .filter((id): id is string => !!id);
    if (recipients.length === 0) return;

    try {
      if (tipo === 'triagem_reds') {
        await this.handleReds(avaliacao, atletaNome, recipients);
      } else if (tipo === 'exames_laboratoriais') {
        await this.handleLab(avaliacao, atletaNome, recipients);
      } else if (tipo === 'psicologia') {
        await this.handlePsicologia(avaliacao, atletaNome, recipients);
      }
    } catch {
      // Alertas são best-effort — não interrompem o fluxo principal
    }
  }

  private async handleReds(avaliacao: Avaliacao, atletaNome: string, recipients: string[]): Promise<void> {
    const classificacao = extractRedsClassificacao(avaliacao);
    if (!classificacao || !isRedsRisk(classificacao)) return;

    const label = classificacao.replace(/_/g, ' ');
    await this.notificacoes.createForUsers(recipients, {
      titulo: `Triagem de Disponibilidade Energetica — risco identificado`,
      mensagem: 'Há uma triagem que requer revisão. Consulte a fila de pacientes vinculados para verificar os detalhes.',
      tipo: 'alerta_clinico',
    });
  }

  private async handleLab(avaliacao: Avaliacao, atletaNome: string, recipients: string[]): Promise<void> {
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

    await this.notificacoes.createForUsers(recipients, {
      titulo: `Exames laboratoriais — achados relevantes`,
      mensagem: 'Há exames que requerem revisão. Consulte a fila de pacientes vinculados antes da próxima conduta.',
      tipo: 'alerta_clinico',
    });
  }

  private async handlePsicologia(avaliacao: Avaliacao, atletaNome: string, recipients: string[]): Promise<void> {
    const { phq9AboveCutOff, gad7AboveCutOff, phq9Score, gad7Score } = extractPsicologiaFlags(avaliacao);
    if (!phq9AboveCutOff && !gad7AboveCutOff) return;

    const parts: string[] = [];
    if (phq9AboveCutOff && phq9Score !== null) {
      parts.push(`PHQ-9 = ${phq9Score} (acima do ponto de corte)`);
    }
    if (gad7AboveCutOff && gad7Score !== null) {
      parts.push(`GAD-7 = ${gad7Score} (acima do ponto de corte)`);
    }

    await this.notificacoes.createForUsers(recipients, {
      titulo: `Avaliação psicológica — atenção necessária`,
      mensagem: 'Há uma avaliação que requer atenção. Consulte a fila de pacientes vinculados para verificar o encaminhamento.',
      tipo: 'alerta_clinico',
    });
  }
}
