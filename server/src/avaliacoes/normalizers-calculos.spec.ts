// Regressão dos defeitos de cálculo do WI-013 (frente 1), um bloco por defeito.
// Dados sintéticos; nenhum paciente real.
import type { Avaliacao } from './avaliacao.entity';
import type { NotificacoesService } from '../notificacoes/notificacoes.service';
import { ClinicalAlertsService } from './clinical-alerts.service';
import { normalizePerimetrosPayload } from './perimetros-normalizer';
import { normalizeExamesLaboratoriaisPayload } from './exames-laboratoriais-normalizer';
import { normalizeEvolucaoRetornoPayload } from './evolucao-retorno-normalizer';
import { normalizeHidratacaoPayload } from './hidratacao-normalizer';
import { normalizeAvaliacaoAlimentarPayload } from './alimentar-normalizer';

type Registro = Record<string, any>;

const dadosDe = (payload: unknown): Registro => ((payload as Registro)?.dados || {}) as Registro;
const resultadosDe = (payload: unknown): Registro => ((payload as Registro)?.resultados || {}) as Registro;

describe('Defeito 1 - YMCA recalculado no servidor em polegadas e libras', () => {
  const perimetros = (dados: Registro): Registro => normalizePerimetrosPayload({
    tipo: 'perimetros',
    dados,
    resultados: {}
  });

  it('converte cintura e peso: homem 80 cm e 75 kg dá cerca de 11,3%, não ~300%', () => {
    const payload = perimetros({ peso_kg: 75, cintura_cm: 80, sexo: 'male' });
    const valor = dadosDe(payload).percentual_gordura_ymca;
    expect(valor).toBeCloseTo(11.33, 1);
    expect(dadosDe(payload).resultados_calculados.percentualGorduraYmca).toBe(valor);
    expect(resultadosDe(payload).calculated.percentualGorduraYmca).toBe(valor);
    expect(resultadosDe(payload).output.ymca).toBe('Adequado');
  });

  it('mulher 75 cm e 60 kg dá cerca de 26,4% (antes ~383%)', () => {
    const payload = perimetros({ peso_kg: 60, cintura_cm: 75, sexo: 'feminino' });
    expect(dadosDe(payload).percentual_gordura_ymca).toBeCloseTo(26.41, 1);
    expect(dadosDe(payload).classificacoes.ymca).toBe('Adequado');
  });

  it('ignora o valor absurdo enviado pelo cliente e recalcula', () => {
    const payload = perimetros({
      peso_kg: 75,
      cintura_cm: 80,
      sexo: 'male',
      percentual_gordura_ymca: 303.2,
      resultados_calculados: { percentualGorduraYmca: 303.2 },
      classificacoes: { ymca: 'Elevado' }
    });
    expect(dadosDe(payload).percentual_gordura_ymca).toBeCloseTo(11.33, 1);
    expect(dadosDe(payload).classificacoes.ymca).toBe('Adequado');
  });

  it('resultado fora de 2 a 70% fica nulo, com aviso na classificação', () => {
    const payload = perimetros({ peso_kg: 80, cintura_cm: 70, sexo: 'male' });
    expect(dadosDe(payload).percentual_gordura_ymca).toBeNull();
    expect(resultadosDe(payload).percentual_gordura_ymca).toBeNull();
    expect(String(dadosDe(payload).classificacoes.ymca)).toMatch(/fora da faixa plaus/i);
  });

  it('sem sexo não estima: nulo e "Sem classificacao YMCA"', () => {
    const payload = perimetros({ peso_kg: 75, cintura_cm: 80, percentual_gordura_ymca: 303.2 });
    expect(dadosDe(payload).percentual_gordura_ymca).toBeNull();
    expect(dadosDe(payload).classificacoes.ymca).toBe('Sem classificacao YMCA');
  });
});

describe('Defeito 2 - status do painel de Exames que o aviso de conduta lê', () => {
  it('um analito fora da referência gera "alterado" com escore 20 (abaixo de 40)', () => {
    const payload = normalizeExamesLaboratoriaisPayload({
      tipo: 'exames_laboratoriais',
      dados: {
        painel: 'lipidograma',
        analitos: [
          { nome: 'LDL', valor: 151, referenciaMin: 0, referenciaMax: 129 },
          { nome: 'HDL', valor: 50, referenciaMin: 40, referenciaMax: 60 }
        ]
      },
      resultados: {}
    });
    expect(dadosDe(payload).classificacoes.statusPainel).toBe('alterado');
    expect(dadosDe(payload).resultados_calculados.scoreRisco).toBe(20);
  });

  it('sem valor nenhum gera "sem_classificacao"', () => {
    const payload = normalizeExamesLaboratoriaisPayload({
      tipo: 'exames_laboratoriais',
      dados: { painel: 'geral', analitos: [{ nome: 'Ferritina', referenciaMin: 15, referenciaMax: 200 }] },
      resultados: {}
    });
    expect(dadosDe(payload).classificacoes.statusPainel).toBe('sem_classificacao');
  });
});

describe('Defeito 3 - escore de adesão da Evolução sem componente ausente como 0', () => {
  const evolucao = (dados: Registro, resultadosCalculados: Registro = {}): Registro => normalizeEvolucaoRetornoPayload({
    tipo: 'evolucao_retorno',
    dados: { ...dados, resultados_calculados: resultadosCalculados },
    resultados: {}
  });

  it('com os três componentes, a média ponderada é a de antes', () => {
    const payload = evolucao({ adesaoPlanoAlimentar: 80, adesaoAtividadeFisica: 70, respostaPercebida: 4 });
    expect(dadosDe(payload).resultados_calculados.scoreAdesaoGeral).toBe(75.75);
    expect(dadosDe(payload).classificacoes.prioridadeRetorno).toBe('baixa');
  });

  it('só a adesão alimentar (80): escore 80, não 40', () => {
    const payload = evolucao({ adesaoPlanoAlimentar: 80 });
    expect(dadosDe(payload).resultados_calculados.scoreAdesaoGeral).toBe(80);
    expect(resultadosDe(payload).score_adesao_geral).toBe(80);
    expect(dadosDe(payload).classificacoes.prioridadeRetorno).toBe('baixa');
  });

  it('alimentar 80 e atividade 60, sem resposta: pesos 0,5 e 0,35 redistribuídos', () => {
    const payload = evolucao({ adesaoPlanoAlimentar: 80, adesaoAtividadeFisica: 60 });
    expect(dadosDe(payload).resultados_calculados.scoreAdesaoGeral).toBeCloseTo(71.76, 2);
    expect(dadosDe(payload).classificacoes.prioridadeRetorno).toBe('moderada');
  });

  it('sem nenhum componente: escore e prioridade nulos, rótulo "Sem classificação"', () => {
    const payload = evolucao({ sintomas: 'fadiga recorrente ha duas semanas' });
    expect(dadosDe(payload).resultados_calculados.scoreAdesaoGeral).toBeNull();
    expect(resultadosDe(payload).score_adesao_geral).toBeNull();
    expect(dadosDe(payload).classificacoes.prioridadeRetorno).toBeNull();
    expect(resultadosDe(payload).prioridade_cuidado).toBeNull();
    expect(payload.classificacao).toBe('sem_classificacao');
    expect(payload.classificacaoLabel).toBe('Sem classificação');
  });

  it('não grava o escore 0 que um cliente antigo mandava para campos vazios', () => {
    const payload = evolucao({}, { scoreAdesaoGeral: 0 });
    expect(dadosDe(payload).resultados_calculados.scoreAdesaoGeral).toBeNull();
    expect(dadosDe(payload).classificacoes.prioridadeRetorno).toBeNull();
  });
});

describe('Defeito 5 - Hidratação com ganho de peso nunca grava negativo', () => {
  const hidratacao = (dados: Registro, resultados: Registro = {}): Registro => normalizeHidratacaoPayload({
    tipo: 'hidratacao',
    dados,
    resultados
  });

  it('perda real continua como antes', () => {
    const payload = hidratacao({
      pesoAntesExercicio: 70, pesoAposExercicio: 68.9, duracaoExercicioMin: 60, volumeIngeridoMl: 500, volumeUrinarioMl: 100
    });
    expect(dadosDe(payload).perdaPesoAbsolutaKg).toBe(1.1);
    expect(dadosDe(payload).perdaHidricaLiquidaMl).toBe(1500);
    expect(dadosDe(payload).taxaSudoreseLh).toBe(1.5);
  });

  it('ganho de 1 kg sem ingestão: perda, suor e sudorese nulos, nada negativo', () => {
    const payload = hidratacao({ pesoAntesExercicio: 70, pesoAposExercicio: 71, duracaoExercicioMin: 60 });
    const dados = dadosDe(payload);
    expect(dados.perdaPesoAbsolutaKg).toBeNull();
    expect(dados.perdaPesoPercentual).toBeNull();
    expect(dados.perdaHidricaLiquidaMl).toBeNull();
    expect(dados.taxaSudoreseLh).toBeNull();
    expect(resultadosDe(payload).calculated.perdaHidricaLiquidaMl).toBeNull();
    expect(resultadosDe(payload).output.classificacaoHidrica).toBe('Sem perda relevante');
  });

  it('ganho de 0,3 kg com 1000 ml ingeridos: perda de suor positiva (700 ml) é mantida', () => {
    const payload = hidratacao({
      pesoAntesExercicio: 70, pesoAposExercicio: 70.3, duracaoExercicioMin: 60, volumeIngeridoMl: 1000, volumeUrinarioMl: 0
    });
    expect(dadosDe(payload).perdaPesoAbsolutaKg).toBeNull();
    expect(dadosDe(payload).perdaHidricaLiquidaMl).toBe(700);
    expect(dadosDe(payload).taxaSudoreseLh).toBe(0.7);
  });

  it('valores negativos vindos de um cliente antigo viram nulos', () => {
    const payload = hidratacao(
      {
        pesoAntesExercicio: 70, pesoAposExercicio: 71, duracaoExercicioMin: 60,
        perdaPesoAbsolutaKg: -1, perdaPesoPercentual: -1.43, perdaHidricaLiquidaMl: -1000,
        taxaSudoreseLh: -1, taxaSudorese: -16.67, perdaSuor: -1000
      },
      { metaReposicaoMl: -1500, calculated: { metaReposicaoMl: -1500 }, output: { metaReposicaoMl: -1500 } }
    );
    const dados = dadosDe(payload);
    const resultados = resultadosDe(payload);
    expect(dados.perdaPesoAbsolutaKg).toBeNull();
    expect(dados.perdaPesoPercentual).toBeNull();
    expect(dados.perdaHidricaLiquidaMl).toBeNull();
    expect(dados.taxaSudoreseLh).toBeNull();
    expect(dados.taxaSudorese).toBeNull();
    expect(dados.perdaSuor).toBeNull();
    expect(resultados.metaReposicaoMl).toBeNull();
    expect(resultados.calculated.metaReposicaoMl).toBeNull();
    expect(resultados.output.metaReposicaoMl).toBeNull();
  });
});

describe('Defeito 6 - Alimentar com total zero não é "Padrão saudável"', () => {
  it('sem kcal por grupo: percentuais e classificação nulos', () => {
    const payload: Registro = normalizeAvaliacaoAlimentarPayload({ tipo: 'alimentar', dados: {}, resultados: {} });
    const percentuais = resultadosDe(payload).percentuais;
    expect(percentuais).toEqual({
      in_natura: null,
      minimamente_processados: null,
      processados: null,
      ultraprocessados: null
    });
    expect(dadosDe(payload).classificacao).toBeNull();
    expect(resultadosDe(payload).output.classificacao).toBeNull();
    expect(payload.classificacao).toBeNull();
    expect(payload.classificacaoLabel).toBeNull();
  });

  it('descarta a classificação "Padrao saudavel" enviada para um total zero', () => {
    const payload: Registro = normalizeAvaliacaoAlimentarPayload({
      tipo: 'alimentar',
      dados: { categorias: { in_natura: 0, ultraprocessados: 0 }, classificacao: 'Padrao saudavel' },
      resultados: {},
      classificacao: 'Padrao saudavel',
      classificacaoLabel: 'Padrao saudavel'
    });
    expect(payload.classificacao).toBeNull();
    expect(payload.classificacaoLabel).toBeNull();
  });

  it('lê as chaves no singular que a tela do R24h envia (ultraprocessado, processado)', () => {
    const payload: Registro = normalizeAvaliacaoAlimentarPayload({
      tipo: 'alimentar',
      dados: {
        categorias: { in_natura: 500, minimamente_processado: 300, processado: 200, ultraprocessado: 1000 }
      },
      resultados: {}
    });
    const percentuais = resultadosDe(payload).percentuais;
    expect(percentuais.ultraprocessados).toBe(50);
    expect(percentuais.processados).toBe(10);
    expect(payload.classificacao).toBe('Padrao de alto risco');
  });

  it('com kcal por grupo, a distribuição e a classificação seguem as de antes', () => {
    const payload: Registro = normalizeAvaliacaoAlimentarPayload({
      tipo: 'alimentar',
      dados: { kcalInNatura: 400, kcalMinimamenteProcessados: 300, kcalProcessados: 200, kcalUltraprocessados: 100 },
      resultados: {}
    });
    expect(resultadosDe(payload).percentuais.ultraprocessados).toBe(10);
    expect(payload.classificacao).toBe('Padrao moderado');
  });
});

describe('Defeito 7 - a faixa baixa de disponibilidade energética gera alerta', () => {
  type CriarParaUsuarios = NotificacoesService['createForUsers'];

  const disparar = async (classificacaoDE: string) => {
    const chamadas: Parameters<CriarParaUsuarios>[] = [];
    const notificacoes: Pick<NotificacoesService, 'createForUsers'> = {
      createForUsers: async (...args: Parameters<CriarParaUsuarios>) => {
        chamadas.push(args);
        return [];
      }
    };
    const service = new ClinicalAlertsService(notificacoes as NotificacoesService);
    const avaliacao: Pick<Avaliacao, 'tipo' | 'status' | 'dados' | 'resultados'> = {
      tipo: 'triagem_reds',
      status: 'finalizada',
      dados: { classificacaoDE },
      resultados: {}
    };
    await service.dispatch(avaliacao as Avaliacao, { nome: 'Atleta sintético', professorSupervisorId: 'prof-sintetico' });
    return chamadas;
  };

  it('reds_estabelecido (DE < 30, a mais grave) gera alerta', async () => {
    const chamadas = await disparar('reds_estabelecido');
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0][1].tipo).toBe('alerta_clinico');
  });

  it('risco_relativo (reduzida) continua gerando alerta', async () => {
    expect(await disparar('risco_relativo')).toHaveLength(1);
  });

  it('otima (adequada) não gera alerta', async () => {
    expect(await disparar('otima')).toHaveLength(0);
  });
});
