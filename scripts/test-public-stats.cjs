/* Numeros da pagina publica (/public/stats).
 *
 * A primeira pagina mostra "atletas ativos, avaliacoes finalizadas e membros
 * ativos". "Membros" contava todo usuario ativo - inclusive atletas, que tem
 * conta para acompanhar o proprio atendimento -, entao os atletas apareciam
 * duas vezes. O repositorio falso abaixo EXECUTA as condicoes da consulta
 * sobre linhas sinteticas; uma condicao que ele nao conhece derruba o teste,
 * em vez de passar sem ter sido avaliada. */
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
require(path.join(root, 'server/node_modules/ts-node')).register({ project: path.join(root, 'server/tsconfig.json'), transpileOnly: true });
require(path.join(root, 'server/node_modules/reflect-metadata'));
const { PublicService } = require(path.join(root, 'server/src/public/public.service.ts'));

let passed = 0;
const check = async (name, fn) => { await fn(); passed += 1; console.log(`PASS ${name}`); };

const CONDICOES = [
  [/^\w+\.status = :status$/, (row, p) => row.status === p.status],
  [/^\w+\.deletedAt IS NULL$/, (row) => !row.deletedAt],
  [/^LOWER\(\w+\.role\) <> :atleta$/, (row, p) => String(row.role || '').toLowerCase() !== p.atleta]
];

function repositorio(linhas) {
  return {
    createQueryBuilder() {
      const filtros = [];
      const qb = {
        where(sql, params = {}) { return qb.andWhere(sql, params); },
        andWhere(sql, params = {}) {
          const regra = CONDICOES.find(([re]) => re.test(sql.trim()));
          if (!regra) throw new Error(`condicao nao avaliada pelo teste: ${sql}`);
          filtros.push((row) => regra[1](row, params));
          return qb;
        },
        async getCount() { return linhas.filter((row) => filtros.every((f) => f(row))).length; }
      };
      return qb;
    }
  };
}

const usuarios = [
  { role: 'aluno', status: 'ativo' },
  { role: 'presidente', status: 'ativo' },
  { role: 'professor', status: 'ativo' },
  { role: 'admin', status: 'ativo' },
  { role: 'atleta', status: 'ativo' },
  { role: 'Atleta', status: 'ativo' },
  { role: 'aluno', status: 'inativo' },
  { role: 'aluno', status: 'ativo', deletedAt: new Date() }
];
const pacientes = [
  { status: 'ativo' }, { status: 'ativo' }, { status: 'lista de espera' }, { status: 'ativo', deletedAt: new Date() }
];
const avaliacoes = [
  { status: 'finalizada' }, { status: 'finalizada' }, { status: 'finalizada' }, { status: 'rascunho' }
];

(async () => {
  await check('membros conta so quem faz parte da liga: atleta com conta nao entra', async () => {
    const service = new PublicService(repositorio(pacientes), repositorio(usuarios), repositorio(avaliacoes));
    const stats = await service.getPublicStats();
    assert.equal(stats.membros, 4, 'aluno, presidente, professor e admin ativos; atletas, inativos e excluidos fora');
  });

  await check('atletas e avaliacoes seguem as definicoes que a pagina anuncia', async () => {
    const service = new PublicService(repositorio(pacientes), repositorio(usuarios), repositorio(avaliacoes));
    const stats = await service.getPublicStats();
    assert.equal(stats.atletas, 2, 'pacientes ativos, sem os excluidos nem os da lista de espera');
    assert.equal(stats.avaliacoes, 3, 'so avaliacoes finalizadas - a frase publica diz "finalizadas"');
  });

  console.log(`\n${passed} verificações dos números públicos passaram.`);
})().catch((error) => { console.error(error); process.exit(1); });
