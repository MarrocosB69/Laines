import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  AnalyticsPerfilService,
  GRUPO_MINIMO,
  montarDistribuicao,
  resolverPeriodoRelatorio,
  suprimirCelulas
} from './analytics-perfil.service';
import { AnalyticsRelatoriosExtraController } from './analytics-relatorios-extra.controller';
import { resolveReportPeriods } from './analytics.service';
import { canAccessAthleteProfileAggregates } from '../auth/access-control';
import { buildCapabilities } from '../auth/authorization';
import { PERMISSIONS, USER_ROLES } from '../common/domain/access.constants';

/*
 * WI-016, etapa 2. Dados 100% sinteticos: nenhum id, nome ou CPF corresponde
 * a pessoa real. Os repositorios falsos devolvem TODAS as linhas, ignorando o
 * `where`, para provar que o filtro em memoria (status, periodo, escopo)
 * segura sozinho o que nao deve entrar.
 */

const NOW = new Date('2026-10-15T15:00:00Z');
const PERIODO = resolverPeriodoRelatorio('month', NOW);
const PROJ_A = 'a0000000-0000-4000-8000-00000000000a';
const PROJ_B = 'b0000000-0000-4000-8000-00000000000b';

type Pac = { id: string; nome: string; cpf: string; prontuario: string; email: string;
  sexoBiologico?: string | null; dataNascimento?: string | null; modalidadePrincipal?: string | null };
type Av = { id: string; pacienteId: string; alunoId: string; tipo: string; status: string; projetoId: string | null;
  data: string | null; createdAt: Date; classificacao?: string | null; classificacaoLabel?: string | null;
  resultados?: Record<string, unknown> | null };

let seq = 0;
const pac = (n: number, extra: Partial<Pac> = {}): Pac => ({
  id: `pac-sint-${String(n).padStart(3, '0')}`,
  nome: `Atleta Sintetico ${n}`,
  cpf: `000000000${String(n).padStart(2, '0')}`,
  prontuario: `PRONT-SINT-${n}`,
  email: `sintetico${n}@exemplo.invalid`,
  sexoBiologico: 'feminino',
  dataNascimento: '2004-03-10',
  modalidadePrincipal: 'Futebol',
  ...extra
});
const av = (pacienteId: string, tipo: string, extra: Partial<Av> = {}): Av => {
  seq += 1;
  return {
    id: `av-sint-${seq}`,
    pacienteId,
    alunoId: 'aluno-sint-1',
    tipo,
    status: 'finalizada',
    projetoId: PROJ_A,
    data: '2026-10-05',
    createdAt: new Date('2026-10-05T12:00:00Z'),
    ...extra
  };
};

const criarServico = (avaliacoes: Av[], pacientes: Pac[]) => {
  const chamadas: { pacientes: unknown[] } = { pacientes: [] };
  const avaliacoesRepo = { find: async () => avaliacoes };
  const pacientesRepo = {
    find: async (opcoes: { where: { id: unknown }; select: unknown }) => {
      chamadas.pacientes.push(opcoes.select);
      const operador = opcoes.where.id as { value?: string[] };
      const ids = new Set(operador.value || []);
      return pacientes.filter((p) => ids.has(p.id));
    }
  };
  const service = new AnalyticsPerfilService(avaliacoesRepo as never, pacientesRepo as never);
  return { service, chamadas };
};

const gerar = (avaliacoes: Av[], pacientes: Pac[], projectId = 'all') => (
  criarServico(avaliacoes, pacientes).service.getPerfilAtletas({ periodo: PERIODO, projectId, now: NOW })
);

const celula = (categorias: Array<{ chave: string; n: number | null; suprimido: boolean }>, chave: string) => (
  categorias.find((item) => item.chave === chave)
);

describe('Supressao de grupo pequeno (k >= 5)', () => {
  it('celula com n entre 1 e 4 sai null e marcada; zero continua zero', () => {
    const resultado = suprimirCelulas([
      { chave: 'a', rotulo: 'A', n: 10 },
      { chave: 'b', rotulo: 'B', n: 2 },
      { chave: 'c', rotulo: 'C', n: 4 },
      { chave: 'd', rotulo: 'D', n: 0 }
    ]);
    expect(resultado).toEqual([
      { chave: 'a', rotulo: 'A', n: 10, suprimido: false },
      { chave: 'b', rotulo: 'B', n: null, suprimido: true },
      { chave: 'c', rotulo: 'C', n: null, suprimido: true },
      { chave: 'd', rotulo: 'D', n: 0, suprimido: false }
    ]);
  });

  it('supressao complementar: com uma unica celula suprimida, a menor nao nula seguinte tambem some', () => {
    const resultado = suprimirCelulas([
      { chave: 'a', rotulo: 'A', n: 10 },
      { chave: 'b', rotulo: 'B', n: 3 },
      { chave: 'c', rotulo: 'C', n: 6 },
      { chave: 'd', rotulo: 'D', n: 0 }
    ]);
    expect(resultado.map((item) => [item.chave, item.n, item.suprimido])).toEqual([
      ['a', 10, false], ['b', null, true], ['c', null, true], ['d', 0, false]
    ]);
  });

  it('sem celula pequena nada e suprimido', () => {
    const resultado = suprimirCelulas([{ chave: 'a', rotulo: 'A', n: 5 }, { chave: 'b', rotulo: 'B', n: 0 }]);
    expect(resultado.map((item) => item.suprimido)).toEqual([false, false]);
  });

  it('denominador abaixo de 5 suprime o bloco inteiro; zero e ausencia de avaliacao, nao supressao', () => {
    for (let n = 1; n < GRUPO_MINIMO; n += 1) {
      expect(montarDistribuicao([{ chave: 'a', rotulo: 'A', n }], n)).toEqual({ denominador: null, suprimido: true, categorias: [] });
    }
    expect(montarDistribuicao([], 0)).toEqual({ denominador: 0, suprimido: false, categorias: [] });
  });
});

describe('Perfil dos atletas: quem sao', () => {
  const montar = () => {
    const pacientes: Pac[] = [];
    // 6 futebol, 5 volei (grafias diferentes), 2 esgrima -> "Outras" (2) some
    // e, pela complementar, volei (5) tambem.
    for (let i = 1; i <= 6; i += 1) pacientes.push(pac(i, { modalidadePrincipal: 'Futebol' }));
    for (let i = 7; i <= 11; i += 1) pacientes.push(pac(i, { modalidadePrincipal: i % 2 ? 'Vôlei' : 'volei' }));
    pacientes.push(pac(12, { modalidadePrincipal: 'Esgrima' }), pac(13, { modalidadePrincipal: 'esgrima ' }));
    // Sexo: 8 F, 5 M. Idade em 15/10/2026: 7 entre 18-24, 5 entre 25-34, 1 com 35+.
    pacientes.forEach((p, index) => {
      p.sexoBiologico = index < 8 ? 'feminino' : 'masculino';
      p.dataNascimento = index < 7 ? '2004-03-10' : index < 12 ? '1996-01-20' : '1980-05-05';
    });
    const avaliacoes = pacientes.map((p) => av(p.id, 'anamnese_inicial'));
    return { pacientes, avaliacoes };
  };

  it('conta modalidade, sexo e faixa etaria com supressao, sem nomear modalidade rara', async () => {
    const { pacientes, avaliacoes } = montar();
    const perfil = await gerar(avaliacoes, pacientes);
    const quem = perfil.blocos.quemSao;
    expect(quem.denominador).toBe(13);
    expect(quem.suprimido).toBe(false);
    expect(celula(quem.modalidade.categorias, 'modalidade_futebol')?.n).toBe(6);
    expect(celula(quem.modalidade.categorias, 'modalidade_volei')?.n).toBeNull();
    expect(celula(quem.modalidade.categorias, 'modalidade_volei')?.suprimido).toBe(true);
    expect(celula(quem.modalidade.categorias, 'outras')?.n).toBeNull();
    expect(JSON.stringify(perfil).toLowerCase().includes('esgrima')).toBe(false);
    expect(celula(quem.sexo.categorias, 'feminino')?.n).toBe(8);
    expect(celula(quem.sexo.categorias, 'masculino')?.n).toBe(5);
    expect(celula(quem.faixaEtaria.categorias, 'ate_17')?.n).toBe(0);
    expect(celula(quem.faixaEtaria.categorias, '18_24')?.n).toBe(7);
    expect(celula(quem.faixaEtaria.categorias, '35_mais')?.n).toBeNull();
    // complementar da faixa: 25-34 (5) some junto com 35+ (1)
    expect(celula(quem.faixaEtaria.categorias, '25_34')?.n).toBeNull();
    expect(perfil.geradoEm).toBe(NOW.toISOString());
    expect(quem.geradoEm).toBe(NOW.toISOString());
  });

  it('com 4 atletas no periodo o bloco inteiro e suprimido, inclusive as distribuicoes', async () => {
    const pacientes = [1, 2, 3, 4].map((n) => pac(n));
    const perfil = await gerar(pacientes.map((p) => av(p.id, 'triagem_reds', { classificacao: 'otima' })), pacientes);
    const quem = perfil.blocos.quemSao;
    expect(quem.denominador).toBeNull();
    expect(quem.suprimido).toBe(true);
    expect(quem.motivo).toBe('grupo_pequeno');
    expect(quem.modalidade.categorias).toHaveLength(0);
    expect(quem.sexo.denominador).toBeNull();
    const de = perfil.blocos.disponibilidadeEnergetica;
    expect(de.denominador).toBeNull();
    expect(de.suprimido).toBe(true);
    expect(de.categorias).toHaveLength(0);
  });

  it('nenhuma chave nem valor de identificacao sai do endpoint', async () => {
    const { pacientes, avaliacoes } = montar();
    avaliacoes.push(...pacientes.slice(0, 6).map((p) => av(p.id, 'dobras_cutaneas', { classificacao: 'Adequado' })));
    const { service, chamadas } = criarServico(avaliacoes, pacientes);
    const perfil = await service.getPerfilAtletas({ periodo: PERIODO, projectId: 'all', now: NOW });
    const proibidas = new Set(['id', 'pacienteid', 'alunoid', 'nome', 'cpf', 'prontuario', 'email', 'alunoresponsavelid', 'projetoid']);
    const chaves: string[] = [];
    const varrer = (valor: unknown) => {
      if (Array.isArray(valor)) { valor.forEach(varrer); return; }
      if (valor && typeof valor === 'object') {
        for (const [chave, item] of Object.entries(valor)) { chaves.push(chave.toLowerCase()); varrer(item); }
      }
    };
    varrer(perfil);
    expect(chaves.filter((chave) => proibidas.has(chave))).toEqual([]);
    const texto = JSON.stringify(perfil);
    for (const p of pacientes) {
      expect(texto.includes(p.id)).toBe(false);
      expect(texto.includes(p.nome)).toBe(false);
      expect(texto.includes(p.cpf)).toBe(false);
      expect(texto.includes(p.prontuario)).toBe(false);
    }
    expect(texto.includes('av-sint-')).toBe(false);
    expect(texto.includes('aluno-sint-')).toBe(false);
    expect(texto.includes(PROJ_A)).toBe(false);
    // A consulta de pacientes so pede o necessario: nem nome nem CPF.
    expect(chamadas.pacientes[0]).toEqual({ id: true, dataNascimento: true, sexoBiologico: true, modalidadePrincipal: true });
  });
});

describe('Perfil dos atletas: escopo por projeto', () => {
  const montar = () => {
    const pacientes: Pac[] = [];
    const avaliacoes: Av[] = [];
    const add = (n: number, projetoId: string | null) => {
      const p = pac(n);
      pacientes.push(p);
      avaliacoes.push(av(p.id, 'anamnese_inicial', { projetoId }));
    };
    for (let i = 1; i <= 6; i += 1) add(i, PROJ_A);
    for (let i = 7; i <= 11; i += 1) add(i, PROJ_B);
    for (let i = 12; i <= 18; i += 1) add(i, null);
    return { pacientes, avaliacoes };
  };

  it('cada escopo conta so as avaliacoes do proprio projeto', async () => {
    const { pacientes, avaliacoes } = montar();
    expect((await gerar(avaliacoes, pacientes, PROJ_A)).blocos.quemSao.denominador).toBe(6);
    expect((await gerar(avaliacoes, pacientes, PROJ_B)).blocos.quemSao.denominador).toBe(5);
    expect((await gerar(avaliacoes, pacientes, 'sem')).blocos.quemSao.denominador).toBe(7);
    expect((await gerar(avaliacoes, pacientes, 'all')).blocos.quemSao.denominador).toBe(18);
    expect((await gerar(avaliacoes, pacientes, PROJ_A)).escopoProjeto).toBe('projeto');
  });

  it('quem nao tem acesso global fica preso ao proprio projeto, mesmo pedindo outro', async () => {
    const recebidos: string[] = [];
    const perfilStub = { getPerfilAtletas: async (p: { projectId: string }) => { recebidos.push(p.projectId); return {}; } };
    const controller = new AnalyticsRelatoriosExtraController(perfilStub as never, {} as never);
    await controller.perfilAtletas({ user: { id: 'u-coord-atd', role: 'coord_atendimento', projetoId: PROJ_B } }, 'month', PROJ_A);
    await controller.perfilAtletas({ user: { id: 'u-admin', role: 'admin' } }, 'month', PROJ_A);
    await controller.perfilAtletas({ user: { id: 'u-pres', role: 'presidente', permissions: ['marketing:create'], projetoId: PROJ_B } }, 'month', 'all');
    expect(recebidos).toEqual([PROJ_B, PROJ_A, PROJ_B]);
    let semProjeto: unknown = null;
    try {
      controller.perfilAtletas({ user: { id: 'u-coord-sem', role: 'coord_atendimento' } }, 'month', 'all');
    } catch (error) { semProjeto = error; }
    expect(semProjeto instanceof ForbiddenException).toBe(true);
    let invalido: unknown = null;
    try {
      controller.perfilAtletas({ user: { id: 'u-admin', role: 'admin' } }, 'month', 'nao-e-uuid');
    } catch (error) { invalido = error; }
    expect(invalido instanceof BadRequestException).toBe(true);
  });
});

describe('Perfil dos atletas: independencia entre tipos', () => {
  const montar = () => {
    const pacientes: Pac[] = [];
    const avaliacoes: Av[] = [];
    for (let i = 1; i <= 12; i += 1) pacientes.push(pac(i, { sexoBiologico: 'feminino' }));
    pacientes.forEach((p, index) => {
      const n = index + 1;
      if (n <= 5) {
        // Triagem: a mais recente do proprio tipo vale (baixa), nao a anterior (adequada).
        avaliacoes.push(av(p.id, 'triagem_reds', { data: '2026-10-02', classificacao: 'otima' }));
        avaliacoes.push(av(p.id, 'triagem_reds', { data: '2026-10-12', classificacao: 'reds_estabelecido' }));
        // Composicao: a bioimpedancia mais recente vale; a dobra anterior nao se mistura.
        avaliacoes.push(av(p.id, 'dobras_cutaneas', { data: '2026-10-03', classificacao: 'Adequado' }));
        avaliacoes.push(av(p.id, 'bioimpedancia', { data: '2026-10-10', classificacao: 'Elevado' }));
      } else if (n <= 10) {
        avaliacoes.push(av(p.id, 'triagem_reds', { data: '2026-10-04', classificacao: null, resultados: { classificacaoDE: 'risco_relativo' } }));
        avaliacoes.push(av(p.id, 'dobras_cutaneas', { data: '2026-10-04', classificacao: 'Adequado' }));
      } else {
        avaliacoes.push(av(p.id, 'anamnese_inicial'));
      }
    });
    // Rascunho mais novo e avaliacao fora do periodo nao contam. O periodo
    // termina hoje (15/10): a avaliacao datada de amanha fica de fora.
    avaliacoes.push(av(pacientes[5].id, 'triagem_reds', { data: '2026-10-14', status: 'rascunho', classificacao: 'otima' }));
    avaliacoes.push(av(pacientes[6].id, 'triagem_reds', { data: '2026-10-16', classificacao: 'otima' }));
    avaliacoes.push(av(pacientes[7].id, 'triagem_reds', { data: '2026-09-30', classificacao: 'otima' }));
    // Paciente excluido do cadastro: sua avaliacao nao entra.
    avaliacoes.push(av('pac-sint-excluido', 'triagem_reds', { classificacao: 'otima' }));
    return { pacientes, avaliacoes };
  };

  it('cada bloco usa so a avaliacao finalizada mais recente do proprio tipo no periodo', async () => {
    const { pacientes, avaliacoes } = montar();
    const perfil = await gerar(avaliacoes, pacientes);
    expect(perfil.blocos.quemSao.denominador).toBe(12);

    const de = perfil.blocos.disponibilidadeEnergetica;
    expect(de.denominador).toBe(10);
    expect(celula(de.categorias, 'adequada')?.n).toBe(0);
    expect(celula(de.categorias, 'reduzida')?.n).toBe(5);
    expect(celula(de.categorias, 'baixa')?.n).toBe(5);
    expect(de.categorias.map((item) => item.rotulo)).toEqual([
      'Disponibilidade energética adequada', 'Disponibilidade energética reduzida', 'Baixa disponibilidade energética'
    ]);
    expect(JSON.stringify(perfil).includes('RED-S')).toBe(false);
    expect(JSON.stringify(perfil).includes('reds_estabelecido')).toBe(false);

    const comp = perfil.blocos.composicaoCorporal;
    expect(comp.denominador).toBe(10);
    expect(celula(comp.metodos.categorias, 'dobras_cutaneas')?.n).toBe(5);
    expect(celula(comp.metodos.categorias, 'bioimpedancia')?.n).toBe(5);
    const fem = comp.porSexo.find((grupo) => grupo.chave === 'feminino');
    expect(fem?.denominador).toBe(10);
    expect(celula(fem?.categorias || [], 'adequado')?.n).toBe(5);
    expect(celula(fem?.categorias || [], 'elevado')?.n).toBe(5);
    expect(comp.porSexo.find((grupo) => grupo.chave === 'masculino')?.denominador).toBe(0);

    // Sem avaliacao do tipo: zero declarado, nao supressao nem numero inventado.
    const ebia = perfil.blocos.insegurancaAlimentar;
    expect(ebia.denominador).toBe(0);
    expect(ebia.motivo).toBe('sem_avaliacao');
    expect(perfil.blocos.hidratacao.denominador).toBe(0);
  });

  it('grupos por sexo pequenos somem com o complementar', async () => {
    const pacientes = [1, 2, 3, 4, 5, 6, 7].map((n) => pac(n, { sexoBiologico: n <= 5 ? 'feminino' : 'masculino' }));
    const avaliacoes = pacientes.map((p) => av(p.id, 'bioimpedancia', { classificacao: 'Adequado' }));
    const perfil = await gerar(avaliacoes, pacientes);
    const comp = perfil.blocos.composicaoCorporal;
    expect(comp.denominador).toBe(7);
    const porSexo = comp.porSexo.map((grupo) => [grupo.chave, grupo.denominador, grupo.suprimido]);
    expect(porSexo).toEqual([['feminino', null, true], ['masculino', null, true]]);
  });
});

describe('Perfil dos atletas: acesso por papel (decisao 2)', () => {
  const podem = [
    { id: 'u1', role: 'admin' },
    { id: 'u2', role: 'coordenacao' },
    { id: 'u3', role: 'coord_atendimento', projetoId: PROJ_A },
    { id: 'u4', role: 'presidente', permissions: ['marketing:create'], projetoId: PROJ_A },
    { id: 'u5', role: 'vice', permissions: ['research:manage'], projetoId: PROJ_A }
  ];
  const naoPodem = [
    { id: 'u6', role: 'aluno', permissions: ['marketing:create'], projetoId: PROJ_A },
    { id: 'u7', role: 'aluno', coordAtendimento: true, projetoId: PROJ_A },
    { id: 'u8', role: 'presidente', permissions: [], projetoId: PROJ_A },
    { id: 'u9', role: 'presidente', permissions: ['ensino:create', 'patients:manage'], projetoId: PROJ_A },
    { id: 'u10', role: 'professor', permissions: ['research:manage'], projetoId: PROJ_A },
    { id: 'u11', role: 'atleta', projetoId: PROJ_A },
    { id: 'u12', role: 'diretoria_marketing', permissions: ['marketing:create'], projetoId: PROJ_A }
  ];

  it('a regra unica aceita so o publico da decisao 2', () => {
    expect(podem.map((u) => canAccessAthleteProfileAggregates(u))).toEqual(podem.map(() => true));
    expect(naoPodem.map((u) => canAccessAthleteProfileAggregates(u))).toEqual(naoPodem.map(() => false));
    expect(canAccessAthleteProfileAggregates(undefined)).toBe(false);
  });

  it('o endpoint responde 403 para quem nao pode e chama o servico para quem pode', async () => {
    let chamadas = 0;
    const controller = new AnalyticsRelatoriosExtraController(
      { getPerfilAtletas: async () => { chamadas += 1; return {}; } } as never, {} as never
    );
    for (const user of podem) await controller.perfilAtletas({ user }, 'month', 'all');
    expect(chamadas).toBe(podem.length);
    for (const user of naoPodem) {
      let erro: unknown = null;
      try { controller.perfilAtletas({ user }, 'month', 'all'); } catch (error) { erro = error; }
      expect(erro instanceof ForbiddenException).toBe(true);
    }
    expect(chamadas).toBe(podem.length);
  });

  it('a capacidade gestao.relatorios.perfilAtletas segue a mesma regra, com permissao derivada da diretoria', () => {
    const cap = (user: { role: string; diretoria?: string; permissions?: string[] }) => (
      buildCapabilities({ id: 'u', ...user }).gestao.relatorios.perfilAtletas
    );
    expect(cap({ role: 'admin' })).toBe(true);
    expect(cap({ role: 'coord_atendimento' })).toBe(true);
    expect(cap({ role: 'presidente', diretoria: 'Marketing' })).toBe(true);
    expect(cap({ role: 'presidente' })).toBe(false);
    expect(cap({ role: 'aluno', diretoria: 'Marketing' })).toBe(false);
    expect(buildCapabilities({ id: 'u', role: 'aluno', diretoria: 'Marketing' }).gestao.relatorios.exportacao).toBe(true);
    expect(cap({ role: 'professor', permissions: ['research:manage'] })).toBe(false);
    expect(cap({ role: 'atleta' })).toBe(false);
  });

  // A aba Relatorios abre com exportacao ou perfilAtletas (src/constants/roles.js,
  // decisao de 12/10/2026). Ela so cresce para quem tem o perfil sem a
  // exportacao; a varredura prova que esse papel e so coord_atendimento.
  it('so coord_atendimento tem o perfil dos atletas sem a exportacao', () => {
    const diretorias = [undefined, 'Ensino', 'Pesquisa', 'Extensao', 'Marketing'];
    const permissoes: string[] = Object.values(PERMISSIONS);
    const conjuntos: string[][] = [[], ...permissoes.map((item) => [item]), permissoes];
    const soPerfil = new Set<string>();
    let casos = 0;
    for (const role of USER_ROLES) {
      for (const diretoria of diretorias) {
        for (const permissions of conjuntos) {
          const relatorios = buildCapabilities({ id: 'u-sint', role, diretoria, permissions }).gestao.relatorios;
          if (relatorios.perfilAtletas && !relatorios.exportacao) soPerfil.add(role);
          casos += 1;
        }
      }
    }
    expect(casos).toBe(USER_ROLES.length * diretorias.length * conjuntos.length);
    expect([...soPerfil]).toEqual(['coord_atendimento']);
  });
});

describe('Periodo civil em Sao Paulo', () => {
  it('mes, trimestre e semana pelo dia de Sao Paulo, e range invalido e recusado', () => {
    expect(resolverPeriodoRelatorio('quarter', NOW)).toEqual({ range: 'quarter', inicio: '2026-10-01', fim: '2026-10-15', fuso: 'America/Sao_Paulo' });
    expect(resolverPeriodoRelatorio('week', NOW).inicio).toBe('2026-10-09');
    // 02:00 UTC de 1/10 ainda e 30/09 em Sao Paulo.
    expect(resolverPeriodoRelatorio('month', new Date('2026-10-01T02:00:00Z')).inicio).toBe('2026-09-01');
    expect(() => resolverPeriodoRelatorio('decada', NOW)).toThrow();
  });

  it('todo periodo termina hoje em Sao Paulo, nunca no fim do mes, do trimestre ou do ano', () => {
    expect(resolverPeriodoRelatorio('month', NOW)).toEqual({ range: 'month', inicio: '2026-10-01', fim: '2026-10-15', fuso: 'America/Sao_Paulo' });
    expect(resolverPeriodoRelatorio('year', NOW)).toEqual({ range: 'year', inicio: '2026-01-01', fim: '2026-10-15', fuso: 'America/Sao_Paulo' });
    expect(resolverPeriodoRelatorio('week', NOW).fim).toBe('2026-10-15');
    // 02:30 UTC de 16/10 ainda e 15/10 em Sao Paulo: hoje continua sendo 15/10.
    expect(resolverPeriodoRelatorio('month', new Date('2026-10-16T02:30:00Z')).fim).toBe('2026-10-15');
    expect(resolverPeriodoRelatorio(undefined, NOW).range).toBe('month');
  });

  it('e o mesmo periodo dos indicadores da etapa 1 (resolveReportPeriods)', () => {
    const momentos = [NOW, new Date('2026-01-01T02:59:00Z'), new Date('2026-03-31T23:00:00Z'), new Date('2024-02-29T12:00:00Z')];
    for (const momento of momentos) {
      for (const range of ['week', 'month', 'quarter', 'year'] as const) {
        const { current } = resolveReportPeriods(range, momento);
        const periodo = resolverPeriodoRelatorio(range, momento);
        expect([periodo.inicio, periodo.fim]).toEqual([current.startDate, current.endDate]);
      }
    }
  });
});
