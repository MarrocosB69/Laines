import { UnprocessableEntityException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AvaliacoesService } from './avaliacoes.service';
import { normalizeAvaliacaoClinicaPayload } from './avaliacao-clinica-normalizer';
import { normalizeTriagemRedsPayload } from './normalizers/triagem-reds-normalizer';
import { normalizeCargaTreinoPayload } from './normalizers/carga-treino-normalizer';

type ClinicaOverrides = {
  pressaoSistolica?: number;
  pressaoDiastolica?: number;
  frequenciaCardiaca?: number;
  frequenciaRespiratoria?: number;
  temperatura?: number;
};

const emptyResultados = (): Record<string, unknown> => ({});

const createService = async () => {
  const module = await Test.createTestingModule({ providers: [AvaliacoesService] })
    .useMocker(() => ({})).compile();
  return module.get(AvaliacoesService);
};

const buildClinicaPayload = (overrides: ClinicaOverrides = {}) => ({
  tipo: 'avaliacao_clinica',
  dados: {
    pressaoSistolica: overrides.pressaoSistolica ?? 120,
    pressaoDiastolica: overrides.pressaoDiastolica ?? 80,
    frequenciaCardiaca: overrides.frequenciaCardiaca ?? 60,
    frequenciaRespiratoria: overrides.frequenciaRespiratoria ?? 16,
    temperatura: overrides.temperatura ?? 36.5
  },
  resultados: emptyResultados()
});

describe('Avaliacao clinica - validacao e classificacao PA', () => {
  it('PA sistolica 0 retorna 422', async () => {
    const service = await createService();
    expect(() => {
      service['assertFinalizationRequirements'](
        'avaliacao_clinica',
        buildClinicaPayload({ pressaoSistolica: 0 }),
        { pacienteRole: 'atleta' }
      );
    }).toThrow(UnprocessableEntityException);
  });

  it('PA sistolica -1 retorna 422', async () => {
    const service = await createService();
    expect(() => {
      service['assertFinalizationRequirements'](
        'avaliacao_clinica',
        buildClinicaPayload({ pressaoSistolica: -1 }),
        { pacienteRole: 'atleta' }
      );
    }).toThrow(UnprocessableEntityException);
  });

  it('PA 180/110 classifica como HAS Estagio 3', () => {
    const normalized = normalizeAvaliacaoClinicaPayload(
      buildClinicaPayload({ pressaoSistolica: 180, pressaoDiastolica: 110 })
    );

    expect(normalized?.resultados?.classificacaoPA).toBe('HAS Estagio 3');
  });

  it('PA 115/75 classifica como Normal', () => {
    const normalized = normalizeAvaliacaoClinicaPayload(
      buildClinicaPayload({ pressaoSistolica: 115, pressaoDiastolica: 75 })
    );

    expect(normalized?.resultados?.classificacaoPA).toBe('Normal');
  });
});

describe('Triagem RED-S - normalizer', () => {
  it('calcula DE e classifica como reds_estabelecido', () => {
    const normalized = normalizeTriagemRedsPayload({
      tipo: 'triagem_reds',
      dados: {
        ingestaoKcalR24h: 1600,
        gastoExercicioKcal: 700,
        massaMagraKg: 50,
        leafQRespostas: Array(12).fill(true)
      },
      resultados: emptyResultados()
    });

    expect(normalized?.resultados?.DE).toBe(18);
    expect(normalized?.resultados?.classificacaoDE).toBe('reds_estabelecido');
    expect(normalized?.resultados?.scoreLeafQ).toBe(12);
  });

  it('aceita campos próprios sem exigir outras avaliações', () => {
    const normalized = normalizeTriagemRedsPayload({
      tipo: 'triagem_reds',
      dados: {
        ingestaoKcalR24hManual: 2200,
        gastoExercicioKcalManual: 500,
        massaMagraKgManual: 52
      },
      resultados: emptyResultados()
    });

    expect(normalized?.resultados?.precisaDadosExtras).toEqual([]);
    expect(normalized?.resultados?.DE).toBeCloseTo(32.69, 2);
    expect(normalized?.resultados?.classificacaoDE).toBe('risco_relativo');
  });

  it('nomeia apenas os campos próprios ainda ausentes', () => {
    const normalized = normalizeTriagemRedsPayload({
      tipo: 'triagem_reds',
      dados: { ingestaoKcalR24hManual: 2200, massaMagraKgManual: 0 },
      resultados: emptyResultados()
    });

    expect(normalized?.resultados?.precisaDadosExtras).toEqual([
      'gastoExercicioKcal',
      'massaMagraKg'
    ]);
    expect(normalized?.resultados?.DE).toBeNull();
  });

  it('mantém legível snapshot legado que só continha fontes automáticas', () => {
    const normalized = normalizeTriagemRedsPayload({
      tipo: 'triagem_reds',
      dados: {
        ingestaoKcalR24hAuto: 1600,
        gastoExercicioKcalAuto: 700,
        massaMagraKgAuto: 50
      },
      resultados: emptyResultados()
    });

    expect(normalized?.resultados?.DE).toBe(18);
    expect(normalized?.resultados?.precisaDadosExtras).toEqual([]);
  });
});

describe('Carga treino - normalizer', () => {
  it('calcula ACWR, monotonia e strain', () => {
    const normalized = normalizeCargaTreinoPayload({
      tipo: 'carga_treino',
      dados: {
        faseAtual: 'competicao',
        estrategiaTreinamento: 'ondulante',
        sessoesSemana: [
          { dia: 'segunda', tipo: 'futebol', duracaoMin: 60, pse: 6 },
          { dia: 'terca', tipo: 'futebol', duracaoMin: 70, pse: 7 },
          { dia: 'quarta', tipo: 'futebol', duracaoMin: 50, pse: 5 },
          { dia: 'quinta', tipo: 'futebol', duracaoMin: 80, pse: 8 },
          { dia: 'sexta', tipo: 'futebol', duracaoMin: 40, pse: 4 }
        ],
        mediaCargaUltimas4Semanas: 1500
      },
      resultados: emptyResultados()
    });

    expect(normalized?.resultados?.cargaSemanaAtual).toBe(1900);
    expect(normalized?.resultados?.acwr).toBeCloseTo(1.2667, 4);
    expect(normalized?.resultados?.classificacaoAcwr).toBe('zona_segura');
    expect(normalized?.resultados?.monotonia).toBeTruthy();
    expect(normalized?.resultados?.strain).toBeTruthy();
  });

  it('classifica ACWR em zona_risco quando > 1.5', () => {
    const normalized = normalizeCargaTreinoPayload({
      tipo: 'carga_treino',
      dados: {
        sessoesSemana: [
          { dia: 'segunda', tipo: 'corrida', duracaoMin: 90, pse: 9 },
          { dia: 'terca', tipo: 'corrida', duracaoMin: 90, pse: 9 }
        ],
        mediaCargaUltimas4Semanas: 800
      },
      resultados: emptyResultados()
    });

    expect(normalized?.resultados?.acwr).toBeGreaterThan(1.5);
    expect(normalized?.resultados?.classificacaoAcwr).toBe('zona_risco');
  });
});
