/* Contrato sintético: sem banco, rede ou dados reais. */
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
require(path.join(root, 'node_modules/ts-node')).register({ project: path.join(root, 'tsconfig.json'), transpileOnly: true });
require(path.join(root, 'node_modules/reflect-metadata'));
const { plainToInstance } = require(path.join(root, 'node_modules/class-transformer'));
const { validateSync } = require(path.join(root, 'node_modules/class-validator'));
const { InscricaoPublicaDto } = require(path.join(root, 'src/public/dto/inscricao-publica.dto.ts'));
const { PublicService } = require(path.join(root, 'src/public/public.service.ts'));
const { PacientesService } = require(path.join(root, 'src/pacientes/pacientes.service.ts'));
const { PacientesController } = require(path.join(root, 'src/pacientes/pacientes.controller.ts'));
const { prioridadeContatoDaTriagem: classify } = require(path.join(root, 'src/pacientes/triagem-publica-prioridade.ts'));
const { projetarRelatorioTriagem: project } = require(path.join(root, 'src/pacientes/triagem-publica-relatorio.ts'));

const severity = (dados) => classify(dados).nivel;
const redsFeminino = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [`leaf_q${i + 1}`, false]));
const redsMasculino = Object.fromEntries(Array.from({ length: 13 }, (_, i) => [`lea_q${i + 1}`, false]));
const ebiaNao = { respostas: Array.from({ length: 3 }, () => ({ resposta: 'Não' })) };
const ebiaSim = { respostas: [{ resposta: 'Sim' }, { resposta: 'Não' }, { resposta: 'Não' }] };
const triagemBase = {
  sexoBiologico: 'feminino', redsInstrumento: 'leaf_q', redsRespostas: redsFeminino,
  redsScore: 42, ebia: ebiaNao, sinaisClinicos: ['nenhum']
};
const energiaUm = { ...triagemBase, redsRespostas: { ...redsFeminino, leaf_q1: true } };
const alimentoUm = { ...triagemBase, ebia: ebiaSim };
const sinaisUm = { ...triagemBase,
  sinaisClinicos: ['cansaco_fadiga', 'mialgia', 'palidez', 'formigamento'] };
assert.equal(severity(triagemBase), 'verde');
assert.deepEqual(classify(triagemBase).criterios,
  { energiaTreino: 0, insegurancaAlimentar: 0, sinaisSintomas: 0 });
assert.equal(classify(triagemBase).pontos, 0);
assert.equal(classify(triagemBase).versao, 'contato-v2');
assert.equal(severity(energiaUm), 'amarelo');
assert.equal(severity(alimentoUm), 'amarelo');
assert.equal(severity({ ...triagemBase, sinaisClinicos: ['cansaco_fadiga', 'mialgia', 'palidez'] }), 'verde');
assert.equal(severity(sinaisUm), 'amarelo');
assert.equal(severity({ ...triagemBase, redsRespostas: { leaf_q1: true } }), 'amarelo');
assert.equal(severity({ ...triagemBase,
  ebia: { respostas: [{ resposta: 'Sim' }, { resposta: null }, { resposta: null }] } }), 'amarelo');
assert.equal(severity({ ...energiaUm, ebia: ebiaSim }), 'vermelho');
assert.equal(classify({ ...energiaUm, ebia: ebiaSim }).pontos, 2);
assert.equal(classify({ ...energiaUm, ebia: ebiaSim, sinaisClinicos: sinaisUm.sinaisClinicos }).pontos, 3);
assert.equal(severity({ ...triagemBase, lesaoAtual: true, impactoLesao: 'interrompida' }), 'verde');
assert.equal(severity({ ...triagemBase, sexoBiologico: 'masculino', redsInstrumento: 'lea_q13',
  redsRespostas: redsMasculino }), 'verde');
assert.equal(severity({ ...triagemBase, sexoBiologico: 'masculino', redsInstrumento: 'lea_q13',
  redsRespostas: { ...redsMasculino, lea_q13: true } }), 'amarelo');
assert.equal(severity({}), 'cinza');
assert.equal(severity({ ...triagemBase, redsRespostas: { leaf_q1: false } }), 'cinza');
assert.equal(severity({ ...triagemBase, redsRespostas: { ...redsFeminino, leaf_q1: 'talvez' } }), 'cinza');
assert.equal(severity({ ...triagemBase, ebia: { respostas: [{ resposta: 'Não' }] } }), 'cinza');
assert.equal(severity({ ...triagemBase, sinaisClinicos: [] }), 'cinza');
assert.equal(severity({ ...triagemBase,
  ebia: { respostas: [{ resposta: 'Talvez' }, { resposta: 'Nao' }, { resposta: 'Nao' }] } }), 'cinza');
assert.equal(severity({ ...triagemBase,
  ebia: { respostas: [{ resposta: 'Sim' }, { resposta: 'Talvez' }, { resposta: null }] } }), 'cinza');
assert.equal(severity({ ...triagemBase, sinaisClinicos: ['nenhum', 'mialgia'] }), 'cinza');
assert.equal(severity({ ...triagemBase, sinaisClinicos: 'nenhum' }), 'cinza');
assert.equal(severity({ ...triagemBase,
  sinaisClinicos: ['cansaco_fadiga', 'CANSACO_FADIGA', 'mialgia', 'palidez'] }), 'verde');
assert.equal(severity({ ...triagemBase,
  sinaisClinicos: ['cansaco_fadiga', 'mialgia', 'palidez', 'sinal_nao_catalogado'] }), 'cinza');
assert.equal(severity({ ...triagemBase, sinaisClinicos: undefined,
  relatoNegativo: { sinais: true } }), 'verde');
assert.equal(severity({ ...triagemBase, ebia: undefined, redsRespostas: energiaUm.redsRespostas,
  sinaisClinicos: sinaisUm.sinaisClinicos }), 'vermelho');
assert.equal(classify({ ...triagemBase, ebia: undefined, redsRespostas: energiaUm.redsRespostas,
  sinaisClinicos: sinaisUm.sinaisClinicos }).pontos, null);

const base = { nome: 'Atleta Sintético', cpf: '52998224725', consentimentoAceito: true };
const sport = { modalidade: 'Corrida', tempoPratica: '1 a 2 anos', duracaoSessao: '65' };
const errors = (body) => validateSync(plainToInstance(InscricaoPublicaDto, body), {
  whitelist: true, forbidNonWhitelisted: true
});
assert.deepEqual(errors({ ...base, esportes: [sport], lesaoAtual: false, lesaoUltimos3Meses: null }), []);
assert.deepEqual(errors({ ...base, esportes: [{ ...sport, frequenciaSemanal: '14' }] }), []);
assert.ok(errors({ ...base, esportes: [{ ...sport, frequenciaSemanal: 0 }] }).length);
assert.ok(errors({ ...base, esportes: [{ ...sport, frequenciaSemanal: 15 }] }).length);
assert.ok(errors({ ...base, esportes: [{ ...sport, frequenciaSemanal: 1.5 }] }).length);
assert.ok(errors({ ...base, esportes: [{ ...sport, frequenciaSemanal: 'diaria' }] }).length);
assert.ok(errors({ ...base, esportes: [] }).length);
assert.ok(errors({ ...base, esportes: [{ ...sport, duracaoSessao: 0 }] }).length);
assert.ok(errors({ ...base, esportes: [{ ...sport, duracaoSessao: 481 }] }).length);
assert.ok(errors({ ...base, esportes: [{ ...sport, tempoPratica: 'inventado' }] }).length);
assert.ok(errors({ ...base, esportes: Array(6).fill(sport) }).length);
assert.ok(errors({ ...base, lesaoAtual: 'false' }).length);
assert.ok(errors({ ...base, impactoLesao: 'grave' }).length);
assert.deepEqual(errors({ ...base, sinaisClinicos: undefined,
  relatoNegativo: { sinais: true } }), []);
assert.ok(errors({ ...base, relatoNegativo: { sinais: 'true' } }).length);

const confirmation = (dados) => ({ origem: 'inscricao_publica', inscricaoPublica: { dados } });
const row = (id, status, createdAt, dados, extra = {}) => ({
  id, status, createdAt: new Date(createdAt), prontuario: `PRT-${id}`, nome: `Pessoa ${id}`,
  confirmacaoAtleta: confirmation(dados), ...extra
});
const rows = [
  row('green', 'Lista de Espera', '2026-09-01', triagemBase),
  row('red-late', 'Lista de Espera', '2026-09-05', { ...energiaUm, ebia: ebiaSim }),
  row('red-early', 'Triagem Publica', '2026-09-02', { ...alimentoUm,
    sinaisClinicos: sinaisUm.sinaisClinicos }),
  row('yellow', 'Triagem', '2026-09-03', energiaUm),
  row('gray', 'Triagem Publica', '2026-09-04', {}),
  row('internal', 'Lista de Espera', '2026-09-01', {}, { confirmacaoAtleta: null }),
  row('internal-triage', 'Triagem Publica', '2026-09-01', {}, { confirmacaoAtleta: null }),
  row('active', 'Ativo', '2026-09-01', {})
];

const query = () => ({
  where() { return this; }, andWhere() { return this; }, orderBy() { return this; },
  async getMany() { return rows.filter((item) => ['Lista de Espera', 'Triagem Publica', 'Triagem'].includes(item.status)); }
});
const service = Object.create(PacientesService.prototype);
service.repo = { createQueryBuilder: query };
const audit = [];
service.auditoria = { create: async (entry) => audit.push(entry) };
const extension = { id: 'ext-user', role: 'diretoria_extensao' };

(async () => {
  const fila = await service.findPublicTriage(extension);
  assert.deepEqual(fila.map((item) => item.id), ['red-early', 'red-late', 'yellow', 'gray', 'green']);
  assert.deepEqual(fila.map((item) => item.posicaoFila), [1, 2, 3, 4, 5]);
  assert.deepEqual(fila.map((item) => item.prioridadeContato.nivel),
    ['vermelho', 'vermelho', 'amarelo', 'cinza', 'verde']);
  assert.deepEqual(fila.map((item) => item.prioridadeContato.pontos), [2, 2, 1, null, 0]);
  assert.ok(fila.every((item) => item.prioridadeContato.motivos.length >= 3));
  await assert.rejects(service.findPublicTriage({ id: 'no', role: 'presidente' }), /permissao/);
  await assert.rejects(service.gerarRelatorioTriagemPublicaPdf({ id: 'no', role: 'atleta' }), /permissao/);
  assert.equal(audit.length, 0);

  const projected = project(fila.map((item) => ({ ...item,
    cpf: '52998224725', telefone: 'SECRET-PHONE', email: 'SECRET@invalid.local',
    historicoSaude: 'SECRET-HEALTH'
  })));
  assert.deepEqual(Object.keys(projected[0]), ['posicao', 'nome', 'protocolo', 'dataInscricao']);
  assert.ok(!JSON.stringify(projected).includes('SECRET'));
  assert.ok(!JSON.stringify(projected).includes('pontos'));
  assert.ok(!JSON.stringify(projected).includes('criterios'));
  assert.ok(!JSON.stringify(projected).includes('vermelho'));
  assert.equal(projected[0].protocolo, 'PRT-red-early');
  const pdf = await service.gerarRelatorioTriagemPublicaPdf(extension);
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.equal(audit.length, 1);
  assert.equal(audit[0].action, 'exportacao_fila_triagem_publica');
  assert.deepEqual(Object.keys(audit[0].meta), ['userId', 'role', 'total', 'versao']);
  assert.equal(audit[0].meta.versao, 'contato-v2');
  const response = {
    headers: {}, body: null,
    setHeader(key, value) { this.headers[key] = value; },
    send(value) { this.body = value; }
  };
  await new PacientesController(service).exportPublicTriagePdf({ user: extension }, response);
  assert.equal(response.headers['Cache-Control'], 'private, no-store');
  assert.equal(response.headers['Content-Type'], 'application/pdf');
  assert.equal(response.body.subarray(0, 5).toString(), '%PDF-');
  assert.equal(audit.length, 2);

  let saved;
  const transactionRepo = {
    query: async (sql) => sql.includes('nextval') ? [{ value: 15 }] : [],
    findOne: async () => null,
    create: (value) => value,
    save: async (value) => { saved = value; return value; }
  };
  const publicRepo = { manager: { transaction: async (fn) => fn({ getRepository: () => transactionRepo }) } };
  const publicService = new PublicService(publicRepo, {}, {});
  await publicService.criarInscricao({ ...base,
    esportes: [{ ...sport, duracaoSessao: 65, frequenciaSemanal: 3 },
      { modalidade: 'Natação', tempoPratica: '2 a 5 anos', duracaoSessao: 45, frequenciaSemanal: 5 }],
    lesaoAtual: false, lesaoUltimos3Meses: true, impactoLesao: 'normal'
  }, 'synthetic-valid');
  assert.equal(saved.status, 'Lista de Espera');
  assert.equal(saved.modalidadePrincipal, 'Corrida');
  assert.equal(saved.duracaoSessao, 65);
  assert.equal(saved.frequenciaSemanal, 3);
  assert.equal(saved.outrasModalidades, 'Natação');
  assert.equal(saved.tipoTreino, 'nao_informado');
  assert.equal(saved.intensidade, 'nao_informado');
  assert.equal(saved.objetivo, 'nao_informado');
  assert.equal(saved.confirmacaoAtleta.origem, 'inscricao_publica');
  assert.equal(saved.confirmacaoAtleta.inscricaoPublica.dados.esportes.length, 2);
  assert.deepEqual(saved.confirmacaoAtleta.inscricaoPublica.dados.esportes.map((item) => item.frequenciaSemanal), [3, 5]);
  assert.equal(saved.confirmacaoAtleta.inscricaoPublica.dados.frequenciaSemanal, 3);
  assert.equal(saved.confirmacaoAtleta.inscricaoPublica.dados.lesaoUltimos3Meses, true);
  await publicService.criarInscricao({ ...base,
    esportes: [{ ...sport, duracaoSessao: 65 }], frequenciaSemanal: 4
  }, 'synthetic-legacy-frequency');
  assert.equal(saved.frequenciaSemanal, 4);
  assert.equal(saved.confirmacaoAtleta.inscricaoPublica.dados.frequenciaSemanal, 4);
  await publicService.criarInscricao({ ...base,
    esportes: [{ ...sport, duracaoSessao: 65 }]
  }, 'synthetic-legacy-without-frequency');
  assert.equal(saved.frequenciaSemanal, undefined);
  await assert.rejects(publicService.criarInscricao({ ...base,
    esportes: [{ ...sport, duracaoSessao: 65 }, { ...sport, modalidade: '  Córrida  ', duracaoSessao: 65 }]
  }, 'synthetic-duplicate'), /distintas/);
  process.stdout.write('PASS triagem publica: contrato, prioridade, fila, acesso, PDF e snapshot\n');
})().catch((error) => { console.error(error); process.exitCode = 1; });
