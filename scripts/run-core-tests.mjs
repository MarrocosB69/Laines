import assert from 'node:assert/strict';
import {
  estadoDoProntuario,
  pendenciasDo,
  prontaParaFinalizar,
  estaFechada,
  divergenciasDo
} from '../src/core/prontuario/estado.js';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ADMIN_AREA_ROLES,
  PROFESSOR_AREA_ROLES,
  getRedirectPathFromRole,
  normalizeRole
} from '../src/constants/roles.js';
import {
  formatDate,
  toDate,
  toDateKey,
  toLocalDateInputValue
} from '../src/utils/dateUtils.js';
import {
  getUserDisplayName,
  normalizeUserList,
  normalizeUserRecord
} from '../src/utils/userAdapter.js';
import {
  ancoraEm,
  calcularPlano,
  cobertura,
  choDisponivel,
  cargaGlicemicaItem,
  distribuicaoEnergetica,
  montarOpcao,
  opcoesDoItem,
  situacaoAdequacao,
  substitutosPara,
  totaisRefeicao,
  migrarRefeicao,
  horarioDe,
  rotuloAncora,
  ordenarPorHorario,
  analisesDoPlano,
  novaDoAlimento,
  categoriaDeCompra,
  distribuicaoNova,
  listaDeCompras,
  porcoesDoItem,
  porcaoDoGrupo
} from '../src/core/prescricao/index.js';
import {
  CATALOGO,
  GRUPOS,
  METAS,
  PLANO_INICIAL,
  REFERENCIAS,
  catalogoPorId,
  comp
} from '../src/constants/prescricao/seed.js';
import {
  calculateHydrationEvaluation,
  calculateNovaEvaluation,
  calculateLaboratoryEvaluation,
  calculateEvolutionReturnEvaluation
} from '../src/services/calculationEngine.js';

const require = createRequire(import.meta.url);
const { extractClientIp } = require('../server/dist/common/request-ip.js');
const { parsePagination } = require('../server/dist/common/pagination.js');
const {
  hasGlobalAccess,
  hasTeamScopedAccess,
  canAccessPatient,
  canReadDetailedAnalytics,
  analyticsProjectScope,
  isStudentMemberRole: isStudentMemberRoleServer,
  normalizeRole: normalizeRoleServer
} = require('../server/dist/auth/access-control.js');
const {
  resolveDirectClinicalLink,
  clinicalScopeCondition,
  resolveCaseCapabilities,
  buildCapabilities
} = require('../server/dist/auth/authorization.js');
const { RolesGuard } = require('../server/dist/auth/roles.guard.js');
const { JwtStrategy } = require('../server/dist/auth/jwt.strategy.js');
const { JwtAuthGuard } = require('../server/dist/auth/jwt-auth.guard.js');
const { AuthService } = require('../server/dist/auth/auth.service.js');
const { UsersController } = require('../server/dist/users/users.controller.js');
const { TarefasService } = require('../server/dist/tarefas/tarefas.service.js');
const { ProjetosService } = require('../server/dist/projetos/projetos.service.js');
const { UsersService } = require('../server/dist/users/users.service.js');
const { ObservabilityController } = require('../server/dist/observability/observability.controller.js');
const { ObservabilityService } = require('../server/dist/observability/observability.service.js');
const { AuditoriaController } = require('../server/dist/auditoria/auditoria.controller.js');
const { AnalyticsController } = require('../server/dist/analytics/analytics.controller.js');
const { ConteudosService } = require('../server/dist/conteudos/conteudos.service.js');
const { PlanoAlimentarService } = require('../server/dist/planos-alimentares/plano-alimentar.service.js');
const { normalizeBioimpedanciaPayload } = require('../server/dist/avaliacoes/bioimpedancia-normalizer.js');
const { normalizeDobrasCutaneasPayload } = require('../server/dist/avaliacoes/dobras-cutaneas-normalizer.js');
const { normalizePerimetrosPayload } = require('../server/dist/avaliacoes/perimetros-normalizer.js');
const { normalizeComposicaoCorporalIntegradaPayload } = require('../server/dist/avaliacoes/composicao-corporal-integrada-normalizer.js');
const { normalizeGastoEnergeticoTotalPayload } = require('../server/dist/avaliacoes/gasto-energetico-total-normalizer.js');
const { normalizeAvaliacaoAlimentarPayload } = require('../server/dist/avaliacoes/alimentar-normalizer.js');
const { normalizeHidratacaoPayload } = require('../server/dist/avaliacoes/hidratacao-normalizer.js');
const { normalizeAvaliacaoSocioeconomicaPayload } = require('../server/dist/avaliacoes/avaliacao-socioeconomica-normalizer.js');
const { normalizeFisioterapiaPayload } = require('../server/dist/avaliacoes/fisioterapia-normalizer.js');
const { normalizePsicologiaPayload } = require('../server/dist/avaliacoes/psicologia-normalizer.js');
const { normalizeExamesLaboratoriaisPayload } = require('../server/dist/avaliacoes/exames-laboratoriais-normalizer.js');
const { normalizeEvolucaoRetornoPayload } = require('../server/dist/avaliacoes/evolucao-retorno-normalizer.js');
const { AvaliacoesService } = require('../server/dist/avaliacoes/avaliacoes.service.js');
const bcrypt = require('../server/node_modules/bcryptjs');
const {
  normalizeUnicodeText,
  normalizeDeepUnicode
} = require('../server/dist/common/text-normalization.js');

const createBasicAvaliacaoQueryBuilder = () => {
  const qb = {
    orderBy: () => qb,
    addOrderBy: () => qb,
    andWhere: () => qb,
    where: () => qb,
    select: () => qb,
    take: () => qb,
    skip: () => qb,
    setParameters: () => qb,
    getMany: async () => [],
    getRawMany: async () => []
  };
  return qb;
};

const createAvaliacaoServiceHarness = ({ pacienteOverrides = {}, repoOverrides = {} } = {}) => {
  const paciente = {
    id: 'paciente-1',
    atletaUserId: 'atleta-1',
    alunoResponsavelId: 'aluno-1',
    projetoId: null,
    projetoNome: '',
    equipeTecnicaIds: [],
    equipeMultiIds: [],
    confirmacaoAtleta: {
      completed: true,
      ebiaSelfForm: {
        enabled: true,
        releaseId: 'release-1',
        releasedAt: '2026-03-20T12:00:00.000Z',
        releasedById: 'staff-1',
        releasedByName: 'Equipe'
      }
    },
    ...pacienteOverrides
  };

  const repo = {
    createQueryBuilder: () => createBasicAvaliacaoQueryBuilder(),
    findOne: async () => null,
    create: (payload) => ({ id: 'avaliacao-1', ...payload }),
    merge: (entity, payload) => ({ ...entity, ...payload }),
    save: async (payload) => ({ id: payload?.id || 'avaliacao-1', ...payload }),
    count: async () => 0,
    ...repoOverrides
  };
  const sessoesRepo = {
    findOne: async ({ where }) => {
      if (where?.id) {
        return { id: where.id, pacienteId: paciente.id, status: 'rascunho' };
      }
      return null;
    },
    save: async (payload) => payload
  };
  const pacientesRepo = {
    findOne: async ({ where }) => (where?.id === paciente.id ? paciente : null),
    save: async () => undefined,
    createQueryBuilder: () => ({
      select: () => pacientesRepo.createQueryBuilder(),
      where: () => pacientesRepo.createQueryBuilder(),
      andWhere: () => pacientesRepo.createQueryBuilder(),
      getQuery: () => 'SELECT id FROM pacientes',
      getParameters: () => ({})
    })
  };
  const usersRepo = {
    findOne: async ({ where }) => {
      if (where?.id === 'aluno-1') {
        return { id: 'aluno-1', role: 'aluno', status: 'ativo' };
      }
      if (where?.id === 'multi-aluno-1') {
        return { id: 'multi-aluno-1', role: 'aluno', status: 'ativo' };
      }
      return null;
    }
  };
  const realtime = { emit: () => undefined };
  const service = new AvaliacoesService(repo, sessoesRepo, pacientesRepo, usersRepo, realtime, undefined, undefined);
  service.syncSessaoStatus = async () => undefined;
  return { service };
};

const createPlanoAlimentarServiceHarness = ({ avaliacaoGet = null, pacienteOverrides = {} } = {}) => {
  const qb = {
    where: () => qb,
    andWhere: () => qb,
    orderBy: () => qb,
    addOrderBy: () => qb,
    getOne: async () => avaliacaoGet
  };
  const paciente = {
    id: 'paciente-1',
    atletaUserId: 'atleta-1',
    alunoResponsavelId: 'aluno-1',
    professorSupervisorId: 'prof-1',
    equipeTecnicaIds: [],
    equipeMultiIds: [],
    ...pacienteOverrides
  };
  const pacientesRepo = {
    findOne: async ({ where }) => (where?.id === paciente.id ? paciente : null)
  };
  const service = new PlanoAlimentarService(
    {},
    pacientesRepo,
    { createQueryBuilder: () => qb }
  );
  return { service };
};

const tests = [
  {
    name: 'roles.normalizeRole',
    run: () => {
      assert.equal(normalizeRole('Diretoria de Extensao'), 'diretoria_extensao');
      assert.equal(normalizeRole('COORDENACAO GERAL'), 'coordenacao');
      assert.equal(normalizeRole('Vice-Presidente'), 'vice');
      assert.equal(normalizeRole('student'), 'aluno');
      assert.equal(normalizeRole('Parceiro'), 'colaborador');
    }
  },
  {
    name: 'roles.redirect',
    run: () => {
      assert.equal(getRedirectPathFromRole('admin'), '/admin');
      assert.equal(getRedirectPathFromRole('aluno', { canAccessAdmin: true }), '/admin');
      assert.equal(getRedirectPathFromRole('professor'), '/professor');
      assert.equal(getRedirectPathFromRole('aluno'), '/aluno');
      assert.equal(getRedirectPathFromRole('tecnico'), '/equipe');
      assert.equal(getRedirectPathFromRole('atleta'), '/atleta');
      assert.equal(ADMIN_AREA_ROLES.includes('coord_atendimento'), false);
      assert.ok(PROFESSOR_AREA_ROLES.includes('profissional'));

      // A rota '/' redireciona o usuario autenticado para o resultado desta
      // mesma funcao. Devolver '/' aqui e um laco infinito que renderiza tela
      // em branco — nenhum papel pode produzir esse destino.
      const PAPEIS = [
        'admin', 'coordenacao', 'presidente', 'vice',
        'diretoria_marketing', 'diretoria_ensino', 'diretoria_pesquisa', 'diretoria_extensao',
        'coord_atendimento', 'professor', 'profissional', 'pesquisador', 'colaborador',
        'tecnico', 'atleta', 'aluno', 'desconhecido', ''
      ];
      for (const papel of PAPEIS) {
        const destino = getRedirectPathFromRole(papel);
        assert.notEqual(destino, '/', `getRedirectPathFromRole('${papel}') devolveu '/' — laco de redirecionamento`);
        assert.ok(destino.startsWith('/') && destino.length > 1, `destino invalido para '${papel}': ${destino}`);
      }
    }
  },
  {
    name: 'date.utils',
    run: () => {
      const value = toLocalDateInputValue(new Date('2026-03-10T15:30:00-03:00'));
      assert.match(value, /^\d{4}-\d{2}-\d{2}$/);
      assert.equal(toDateKey(new Date('2026-03-10T00:00:00-03:00')), '2026-03-10');
      assert.ok(toDate('2026-03-10T10:00:00.000Z') instanceof Date);
      assert.equal(toDate('invalid-date'), null);
      assert.equal(formatDate(new Date(2026, 2, 10)), '10/03/2026');
      const brasil = spawnSync(process.execPath, ['--input-type=module', '-e', `
        import assert from 'node:assert/strict';
        import { formatDate, toDateKey, toDate } from './src/utils/dateUtils.js';
        assert.equal(formatDate('2026-10-13'), '13/10/2026');
        assert.equal(toDateKey('2026-10-13'), '2026-10-13');
        assert.equal(toDate('2026-02-31'), null);
        assert.equal(formatDate('2026-10-13T00:00:00Z'), '12/10/2026');
      `], { cwd: process.cwd(), env: { ...process.env, TZ: 'America/Fortaleza' }, encoding: 'utf8' });
      assert.equal(brasil.status, 0, brasil.stderr);
    }
  },
  {
    name: 'request-ip',
    run: () => {
      assert.equal(extractClientIp({
        ip: '10.0.0.15',
        headers: {
          'x-forwarded-for': '177.10.10.10, 10.0.0.1'
        }
      }), '10.0.0.15');
      assert.equal(extractClientIp({
        ip: '',
        headers: {
          'x-forwarded-for': '177.10.10.10, 10.0.0.1'
        }
      }), '177.10.10.10');
      assert.equal(extractClientIp({
        ip: '::ffff:192.168.1.10',
        headers: {}
      }), '192.168.1.10');
    }
  },
  {
    name: 'pagination.parsePagination',
    run: () => {
      const defaults = parsePagination({ defaultLimit: 40 });
      assert.equal(defaults.limit, 40);
      assert.equal(defaults.offset, undefined);

      const clamped = parsePagination({ limit: '9999', offset: '999999' });
      assert.equal(clamped.limit, 200);
      assert.equal(clamped.offset, 50000);

      const floorValues = parsePagination({ limit: '-3', offset: '-2' });
      assert.equal(floorValues.limit, 1);
      assert.equal(floorValues.offset, 0);

      const invalidValues = parsePagination({ limit: 'abc', offset: 'x', defaultLimit: 300 });
      assert.equal(invalidValues.limit, 200);
      assert.equal(invalidValues.offset, undefined);
    }
  },
  {
    name: 'access-control',
    run: () => {
      assert.equal(normalizeRoleServer('  vice  '), 'vice');
      assert.equal(hasGlobalAccess('admin'), true);
      assert.equal(hasGlobalAccess('coordenacao'), true);
      assert.equal(hasGlobalAccess('diretoria_ensino'), false);
      assert.equal(hasGlobalAccess('aluno'), false);
      assert.equal(hasGlobalAccess('coord_atendimento'), false);

      assert.equal(hasTeamScopedAccess('professor'), true);
      assert.equal(hasTeamScopedAccess('ALUNO'), false);

      assert.equal(isStudentMemberRoleServer('presidente'), true);
      assert.equal(isStudentMemberRoleServer('vice'), true);
      assert.equal(isStudentMemberRoleServer('professor'), false);
    }
  },
  {
    name: 'coord-atendimento.global-read-without-clinical-authorship',
    run: () => {
      const coord = { id: 'coord-1', role: 'coord_atendimento' };
      const unrelated = { id: 'patient-1', alunoResponsavelId: 'student-1' };
      assert.equal(resolveDirectClinicalLink(coord, unrelated), 'coord_atendimento');
      assert.equal(clinicalScopeCondition({ alias: 'paciente', user: coord }), null);
      assert.equal(canAccessPatient(coord, unrelated), true);
      assert.equal(canReadDetailedAnalytics(coord), false);
      assert.equal(analyticsProjectScope(coord), 'all');
      const caseCapabilities = resolveCaseCapabilities(coord, unrelated, 'coord_atendimento', ['anamnese_inicial']);
      assert.equal(caseCapabilities.criaAvaliacao, false);
      assert.equal(caseCapabilities.criaPlano, false);
      const capabilities = buildCapabilities(coord);
      assert.equal(capabilities.atendimento.criaPaciente, true);
      assert.equal(capabilities.atendimento.gerenciaVinculos, true);
      const flaggedStudent = { id: 'student-2', role: 'aluno', coordAtendimento: true };
      assert.equal(resolveDirectClinicalLink(flaggedStudent, unrelated), null);
      assert.equal(canAccessPatient(flaggedStudent, unrelated), false);
    }
  },
  {
    name: 'roles.guard-normalization',
    run: () => {
      const reflector = {
        getAllAndOverride: () => ['admin']
      };
      const guard = new RolesGuard(reflector);
      const context = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({
            user: { role: '  Admin  ' }
          })
        })
      };
      assert.equal(guard.canActivate(context), true);
    }
  },
  {
    name: 'users.controller-view-permissions',
    run: async () => {
      const controller = new UsersController({
        findAll: async () => [{ id: 'user-1' }],
        findPublicById: async () => ({ id: 'user-1' })
      });

      await assert.doesNotReject(() => Promise.resolve(controller.findAll({
        user: {
          role: 'professor',
          permissions: ['admin:access']
        }
      })));

      await assert.doesNotReject(() => Promise.resolve(controller.findAll({
        user: {
          role: 'professor',
          permissions: ['users:manage']
        }
      })));

      await assert.rejects(
        () => controller.findAll({
          user: {
            role: 'professor',
            permissions: []
          }
        }),
        /visualizar membros/i
      );
    }
  },
  {
    name: 'analytics.controller-operational-board-admin-only',
    run: async () => {
      let receivedQuery = null;
      const controller = new AnalyticsController({
        getDashboardOperationalBoard: async (query) => {
          receivedQuery = query;
          return { columns: [] };
        }
      });

      const result = await controller.operationalBoard({
        user: {
          id: 'coordenacao-sintetica',
          role: 'coordenacao',
          permissions: []
        }
      }, 'true', 'all');

      assert.deepEqual(result, { columns: [] });
      assert.deepEqual(receivedQuery, {
        forceRefresh: true,
        projectId: 'all'
      });
      assert.throws(
        () => controller.operationalBoard({
          user: {
            role: 'diretoria_pesquisa',
            permissions: ['admin:access']
          }
        }),
        /painel operacional/
      );
    }
  },
  {
    name: 'mets.controller-auth-guards',
    run: () => {
      const source = fs.readFileSync(
        path.resolve('server/src/mets/mets.controller.ts'),
        'utf8'
      );

      assert.match(source, /@UseGuards\(JwtAuthGuard\)\s*\r?\n@Controller\('mets'\)/);
      assert.match(source, /@UseGuards\(RolesGuard\)\s*\r?\n\s*@Roles\(\.\.\.ADMIN_ROLES\)\s*\r?\n\s*@Post\(\)/);
      assert.match(source, /@UseGuards\(RolesGuard\)\s*\r?\n\s*@Roles\(\.\.\.ADMIN_ROLES\)\s*\r?\n\s*@Patch\(':id'\)/);
      assert.match(source, /@UseGuards\(RolesGuard\)\s*\r?\n\s*@Roles\(\.\.\.ADMIN_ROLES\)\s*\r?\n\s*@Delete\(':id'\)/);
    }
  },
  {
    name: 'auditoria.controller-client-event-allowlist',
    run: async () => {
      let savedPayload = null;
      const controller = new AuditoriaController({
        create: async (payload) => {
          savedPayload = payload;
          return payload;
        }
      });

      await controller.create({
        user: {
          id: 'aluno-1',
          role: 'aluno',
          email: 'aluno@laines.ufrn.br',
          name: 'Aluno Teste'
        }
      }, {
        action: 'avaliacao_create',
        entity: 'avaliacoes',
        entityId: 'avaliacao-1',
        meta: { pacienteId: 'paciente-1' }
      });

      assert.equal(savedPayload?.action, 'avaliacao_create');
      assert.equal(savedPayload?.entity, 'avaliacoes');
      assert.equal(savedPayload?.actor?.id, 'aluno-1');

      assert.throws(
        () => controller.create({
          user: { id: 'atleta-1', role: 'atleta' }
        }, {
          action: 'avaliacao_create',
          entity: 'avaliacoes'
        }),
        /nao pode registrar/i
      );

      assert.throws(
        () => controller.create({
          user: { id: 'admin-1', role: 'admin' }
        }, {
          action: 'evento_inventado',
          entity: 'avaliacoes'
        }),
        /nao permitido/i
      );
    }
  },
  {
    name: 'soft-delete.users-and-pacientes-contract',
    run: () => {
      const userEntitySource = fs.readFileSync(
        path.resolve('server/src/users/user.entity.ts'),
        'utf8'
      );
      const pacienteEntitySource = fs.readFileSync(
        path.resolve('server/src/pacientes/paciente.entity.ts'),
        'utf8'
      );
      const usersServiceSource = fs.readFileSync(
        path.resolve('server/src/users/users.service.ts'),
        'utf8'
      );
      const pacientesServiceSource = fs.readFileSync(
        path.resolve('server/src/pacientes/pacientes.service.ts'),
        'utf8'
      );
      const migrationSource = fs.readFileSync(
        path.resolve('server/src/database/migrations/1775995000000-AddUsersPacientesSoftDelete.ts'),
        'utf8'
      );

      assert.match(userEntitySource, /@DeleteDateColumn\(\{\s*name:\s*'deleted_at'/);
      assert.match(pacienteEntitySource, /@DeleteDateColumn\(\{\s*name:\s*'deleted_at'/);
      assert.match(usersServiceSource, /deleted_at\s+is\s+null/i);
      assert.match(usersServiceSource, /\.softDelete\(id\)/);
      assert.doesNotMatch(usersServiceSource, /repo\.delete\(id\)/);
      assert.match(pacientesServiceSource, /\.softDelete\(id\)/);
      assert.doesNotMatch(pacientesServiceSource, /repo\.delete\(id\)/);
      assert.match(migrationSource, /ALTER TABLE "users" ADD COLUMN "deleted_at"/);
      assert.match(migrationSource, /ALTER TABLE "pacientes" ADD COLUMN "deleted_at"/);
    }
  },
  {
    name: 'avaliacoes.athlete-public-projection-hides-sensitive-classification',
    run: () => {
      const source = fs.readFileSync(
        path.resolve('server/src/avaliacoes/avaliacoes.service.ts'),
        'utf8'
      );

      assert.match(source, /ATHLETE_SENSITIVE_RESULT_TYPES\s*=\s*new Set\(\[/);
      assert.match(source, /'triagem_reds'/);
      assert.match(source, /'psicologia'/);
      assert.match(source, /'exames_laboratoriais'/);
      assert.match(source, /const canExposeClassification = !ATHLETE_SENSITIVE_RESULT_TYPES\.has\(tipo\)/);
      assert.match(source, /classificacao:\s*canExposeClassification \? avaliacao\.classificacao \|\| null : null/);
      assert.match(source, /classificacaoLabel:\s*canExposeClassification \? avaliacao\.classificacaoLabel \|\| null : null/);
    }
  },
  {
    name: 'user-adapter',
    run: () => {
      const normalized = normalizeUserRecord({
        uid: '123',
        nome: ' Ana Silva ',
        email: 'ana@example.com',
        role: 'Vice-Presidente'
      });
      assert.equal(normalized?.id, '123');
      assert.equal(normalized?.name, 'Ana Silva');
      assert.equal(normalized?.nome, 'Ana Silva');
      assert.equal(normalized?.role, 'vice');

      const list = normalizeUserList([
        { userId: '1', name: 'Docente', role: 'professor' },
        null,
        { id: '2', nome: 'Aluno', role: 'student' }
      ]);
      assert.equal(list.length, 2);
      assert.equal(list[1].role, 'aluno');
      assert.equal(getUserDisplayName({ id: '9', email: 'x@y.com' }, 'Fallback'), 'x@y.com');
    }
  },
  {
    name: 'tarefas.service.findAll-scope',
    run: async () => {
      const andWhereCalls = [];
      const queryBuilder = {
        where: () => queryBuilder,
        orderBy: () => queryBuilder,
        andWhere: (clause, params) => {
          andWhereCalls.push({ clause, params });
          return queryBuilder;
        },
        getMany: async () => []
      };
      const repo = {
        createQueryBuilder: () => queryBuilder
      };
      const service = new TarefasService(repo, { emit: () => {} });

      await service.findAll({ role: 'aluno', diretoria: 'diretoria_ensino' }, {});
      assert.equal(andWhereCalls.length, 1);
      assert.match(andWhereCalls[0].clause, /assignedRole/);
      assert.deepEqual(andWhereCalls[0].params, {
        audienceRoles: ['aluno', 'diretoria_ensino'],
        todos: 'todos'
      });
    }
  },
  {
    name: 'tarefas.service.findAll-filters',
    run: async () => {
      const andWhereCalls = [];
      const queryBuilder = {
        where: () => queryBuilder,
        orderBy: () => queryBuilder,
        andWhere: (clause, params) => {
          andWhereCalls.push({ clause, params });
          return queryBuilder;
        },
        getMany: async () => []
      };
      const repo = {
        createQueryBuilder: () => queryBuilder
      };
      const service = new TarefasService(repo, { emit: () => {} });

      await service.findAll(
        { role: 'admin' },
        { assignedRole: 'professor', status: 'pendente' }
      );

      assert.equal(andWhereCalls.length, 2);
      assert.equal(andWhereCalls[0].clause, 'tarefa.assignedRole = :assignedRole');
      assert.deepEqual(andWhereCalls[0].params, { assignedRole: 'professor' });
      assert.equal(andWhereCalls[1].clause, 'tarefa.status = :status');
      assert.deepEqual(andWhereCalls[1].params, { status: 'pendente' });
    }
  },
  {
    name: 'tarefas.service.normalizes-kanban-status-and-audience',
    run: async () => {
      let savedPayload = null;
      const events = { create: (payload) => payload, save: async (payload) => payload };
      const repo = {
        create: (payload) => payload,
        save: async (payload) => {
          savedPayload = payload;
          return payload;
        },
        manager: { transaction: async (work) => work({ getRepository: (entity) => entity.name === 'Tarefa' ? repo : events }) },
        createQueryBuilder: () => ({
          where: () => ({ orderBy: () => ({ getMany: async () => [] }) })
        })
      };
      const service = new TarefasService(repo, { emit: () => {} });

      await service.create({
        title: 'Organizar fluxo',
        status: 'em progresso',
        assignedRole: 'Diretoria de Ensino',
        dueDate: '2026-10-20'
      }, { id: 'actor-1', role: 'admin', name: 'Gestão' });

      assert.equal(savedPayload.status, 'em_andamento');
      assert.equal(savedPayload.assignedRole, 'diretoria_ensino');
      await assert.rejects(
        async () => service.create({
          title: 'Status invalido',
          status: 'aguardando qualquer coisa'
        }, { id: 'actor-1', role: 'admin' }),
        /Status de tarefa invalido/
      );
    }
  },
  {
    name: 'conteudos.service-workflow-permissions',
    run: async () => {
      const whereCalls = [];
      const queryBuilder = {
        orderBy: () => queryBuilder,
        andWhere: (clause, params) => {
          whereCalls.push({ clause, params });
          return queryBuilder;
        },
        getMany: async () => []
      };
      const repo = {
        createQueryBuilder: () => queryBuilder,
        create: (payload) => payload,
        save: async (payload) => payload
      };
      const service = new ConteudosService(repo, { emit: () => {} });
      const diretoriaUser = {
        id: 'ensino-1',
        role: 'aluno',
        diretoria: 'diretoria_ensino',
        name: 'Membro Ensino',
        permissions: []
      };

      const saved = await service.create({
        categoria: 'materiais_ensino',
        titulo: 'Guia de estudo'
      }, diretoriaUser);
      assert.equal(saved.status, 'em_andamento');
      assert.equal(saved.criadoPorId, 'ensino-1');

      await assert.rejects(
        async () => service.create({
          categoria: 'materiais_ensino',
          titulo: 'Guia publicado',
          status: 'publicado'
        }, diretoriaUser),
        /Apenas a coordenacao/
      );

      await service.findAll({ status: 'arquivado' }, { role: 'aluno', permissions: [] });
      assert.equal(whereCalls.length, 2);
      assert.deepEqual(whereCalls[0].params, { status: 'arquivado' });
      assert.equal(whereCalls[1].params, undefined);
    }
  },
  {
    name: 'projetos.service.findAll-student-public-projection',
    run: async () => {
      let findOptions = null;
      const repo = {
        find: async (options) => {
          findOptions = options;
          return [{
            id: 'proj-1',
            nome: 'Projeto Teste',
            area: 'nutricao',
            status: 'planejamento',
            coordenador: 'Coord Teste',
            descricao: 'Descricao',
            alunosIds: ['aluno-1'],
            alunosNomes: ['Aluno Teste'],
            equipe: ['interno']
          }];
        }
      };
      const pacientesRepo = {
        createQueryBuilder: () => ({
          select: () => pacientesRepo.createQueryBuilder(),
          where: () => pacientesRepo.createQueryBuilder(),
          andWhere: () => pacientesRepo.createQueryBuilder(),
          getRawMany: async () => []
        })
      };
      const usersRepo = {
        findOne: async () => null
      };
      const producoesRepo = { find: async () => [] };
      const ideiasRepo = { find: async () => [] };
      const avaliacoesRepo = {};
      const config = { get: () => undefined };

      const service = new ProjetosService(
        repo,
        producoesRepo,
        ideiasRepo,
        pacientesRepo,
        usersRepo,
        avaliacoesRepo,
        config,
        { emit: () => {} }
      );
      const result = await service.findAll({ id: 'aluno-1', role: 'aluno' });
      assert.equal(Array.isArray(result), true);
      assert.equal(findOptions?.order?.createdAt, 'DESC');
      assert.deepEqual(Object.keys(result[0]).sort(), ['id', 'nome', 'status']);
      assert.equal(result[0].id, 'proj-1');
      assert.equal(result[0].nome, 'Projeto Teste');
      assert.equal(result[0].status, 'planejamento');
      assert.equal(result[0].area, undefined);
      assert.equal(result[0].coordenador, undefined);
      assert.equal(result[0].descricao, undefined);
      assert.equal(result[0].alunosNomes, undefined);
      assert.equal(result[0].canAnexar, undefined);
      assert.equal(result[0].equipe, undefined);
    }
  },
  {
    name: 'projetos.service.findAll-team-scoped',
    run: async () => {
      let scopedWhereCalls = 0;
      const repoQb = {
        orderBy: () => repoQb,
        andWhere: () => {
          scopedWhereCalls += 1;
          return repoQb;
        },
        getMany: async () => [{ id: 'proj-1' }]
      };
      const repo = {
        createQueryBuilder: () => repoQb
      };

      const pacientesQb = {
        select: () => pacientesQb,
        where: () => pacientesQb,
        andWhere: () => pacientesQb,
        getRawMany: async () => [{ projetoId: 'proj-paciente-1' }]
      };
      const pacientesRepo = {
        createQueryBuilder: () => pacientesQb
      };
      const usersRepo = {
        findOne: async () => ({ id: 'prof-1', projetoId: 'proj-vinculado-1' })
      };
      const producoesRepo = { find: async () => [] };
      const ideiasRepo = { find: async () => [] };
      const avaliacoesRepo = {};
      const config = { get: () => undefined };

      const service = new ProjetosService(
        repo,
        producoesRepo,
        ideiasRepo,
        pacientesRepo,
        usersRepo,
        avaliacoesRepo,
        config,
        { emit: () => {} }
      );
      const result = await service.findAll({ id: 'prof-1', role: 'professor' });
      assert.equal(scopedWhereCalls, 1);
      assert.equal(Array.isArray(result), true);
      assert.equal(result.length, 1);
    }
  },
  {
    name: 'projetos.service.findAll-deny-unknown-role',
    run: async () => {
      const repo = { find: async () => [] };
      const pacientesRepo = { createQueryBuilder: () => ({}) };
      const usersRepo = { findOne: async () => null };
      const producoesRepo = { find: async () => [] };
      const ideiasRepo = { find: async () => [] };
      const avaliacoesRepo = {};
      const config = { get: () => undefined };
      const service = new ProjetosService(
        repo,
        producoesRepo,
        ideiasRepo,
        pacientesRepo,
        usersRepo,
        avaliacoesRepo,
        config,
        { emit: () => {} }
      );

      await assert.rejects(
        async () => service.findAll({ id: 'x', role: 'visitante' }),
        /Sem permissao para listar projetos/
      );
    }
  },
  {
    name: 'users.service.aluno-requires-project-and-supervisor',
    run: async () => {
      const userRepo = {
        findOne: async ({ where }) => {
          if (where?.email) return null;
          if (where?.id === 'prof-1') {
            return {
              id: 'prof-1',
              role: 'professor',
              status: 'ativo',
              name: 'Professor Teste'
            };
          }
          return null;
        },
        create: (payload) => payload,
        save: async (payload) => ({ ...payload, id: 'user-1' })
      };
      const projetosRepo = {
        findOne: async ({ where }) => {
          if (where?.id === 'proj-1') {
            return {
              id: 'proj-1',
              nome: 'Projeto Teste'
            };
          }
          return null;
        }
      };
      const service = new UsersService(userRepo, projetosRepo);

      await assert.rejects(
        async () => service.createWithTempPassword({
          email: 'aluno@laines.ufrn.br',
          name: 'Aluno Teste',
          role: 'aluno'
        }),
        /supervisor credenciado/i
      );

      await assert.rejects(
        async () => service.createWithTempPassword({
          email: 'aluno2@laines.ufrn.br',
          name: 'Aluno Sem Projeto',
          role: 'presidente',
          supervisorId: 'prof-1'
        }),
        /projeto vinculado/i
      );

      await assert.rejects(
        async () => service.createWithTempPassword({
          email: 'aluno3@laines.ufrn.br',
          name: 'Aluno Sem Dados Academicos',
          role: 'aluno',
          cpf: '52998224725',
          dataNascimento: '2001-01-01',
          supervisorId: 'prof-1',
          projetoId: 'proj-1'
        }),
        /matricula/i
      );
    }
  },
  {
    name: 'users.service.getMeusSupervisionados-profissional-supervisor',
    run: async () => {
      const userRepo = {
        createQueryBuilder: () => {
          const qb = {
            where: () => qb,
            andWhere: () => qb,
            getMany: async () => [{
              id: 'aluno-bruno',
              name: 'Bruno',
              email: 'bruno@laines.ufrn.br',
              matricula: '2026001',
              curso: 'Nutricao',
              periodo: '5',
              supervisorId: 'prof-thaiz',
              supervisorNome: 'Thaiz',
              profissionalId: 'prof-rebeca',
              profissionalNome: 'Rebeca Lugaresi',
              projetoId: 'proj-liga',
              projetoNome: 'Liga LAINES'
            }]
          };
          return qb;
        }
      };
      let pacientesQueryCount = 0;
      const pacientesRepo = {
        createQueryBuilder: () => {
          const isSupervisedQuery = pacientesQueryCount === 0;
          pacientesQueryCount += 1;
          const qb = {
            select: () => qb,
            where: () => qb,
            andWhere: () => qb,
            getMany: async () => isSupervisedQuery
              ? [{
                  id: 'paciente-1',
                  nome: 'Atleta Teste',
                  status: 'Ativo',
                  prontuario: 'PRT-001',
                  modalidadePrincipal: 'Corrida',
                  projetoId: 'proj-liga',
                  projetoNome: 'Liga LAINES',
                  alunoResponsavelId: 'aluno-bruno',
                  alunoResponsavelNome: 'Bruno',
                  professorSupervisorId: 'prof-thaiz',
                  professorSupervisorNome: 'Thaiz',
                  updatedAt: new Date('2026-06-01T12:00:00.000Z'),
                  createdAt: new Date('2026-05-01T12:00:00.000Z')
                }]
              : []
          };
          return qb;
        }
      };

      const service = new UsersService(userRepo, {}, pacientesRepo);
      const result = await service.getMeusSupervisionados('prof-rebeca');

      assert.equal(result.length, 1);
      assert.equal(result[0].supervisaoTipo, 'profissional');
      assert.equal(result[0].supervisao.usuarioEhProfissionalSupervisor, true);
      assert.equal(result[0].supervisao.professor.nome, 'Thaiz');
      assert.equal(result[0].supervisao.profissional.nome, 'Rebeca Lugaresi');
      assert.equal(result[0].resumo.totalPacientes, 1);
      assert.equal(result[0].resumo.pacientesAtivos, 1);
      assert.equal(result[0].pacientes[0].professorSupervisorId, 'prof-thaiz');
    }
  },
  {
    name: 'jwt.strategy-session-version',
    run: async () => {
      const mockUser = {
        id: 'user-1',
        email: 'admin@laines.ufrn.br',
        role: 'admin',
        name: 'Admin',
        status: 'ativo',
        sessionVersion: 3
      };
      const usersService = {
        findById: async () => mockUser,
        findByIdCached: async () => mockUser
      };

      const strategy = new JwtStrategy(
        { get: (key) => (key === 'jwt.secret' ? 'core-test-secret' : undefined) },
        usersService,
        { isFamilyActive: async () => true }
      );

      const valid = await strategy.validate({
        sub: 'user-1',
        email: 'admin@laines.ufrn.br',
        role: 'admin',
        name: 'Admin',
        sv: 3,
        typ: 'access',
        sid: 'family-1'
      });
      assert.equal(valid.id, 'user-1');
      assert.equal(valid.mustChangePassword, false);

      await assert.rejects(
        async () => strategy.validate({
          sub: 'user-1',
          email: 'admin@laines.ufrn.br',
          role: 'admin',
          name: 'Admin',
          sv: 1,
          typ: 'access',
          sid: 'family-1'
        }),
        /Sessao revogada/i
      );
    }
  },
  {
    name: 'jwt-auth-guard.must-change-password-lock',
    run: () => {
      const guard = new JwtAuthGuard({
        get: (key) => {
          if (key === 'auth.guardTokenCacheEnabled') return false;
          if (key === 'auth.guardTokenCacheTtlMs') return 800;
          if (key === 'auth.guardTokenCacheMaxEntries') return 2000;
          return undefined;
        }
      });
      const contextBlocked = {
        switchToHttp: () => ({
          getRequest: () => ({
            method: 'GET',
            path: '/pacientes'
          })
        })
      };

      assert.throws(
        () => guard.handleRequest(null, { id: 'u1', mustChangePassword: true }, null, contextBlocked),
        /Atualize sua senha/
      );

      const contextAllowed = {
        switchToHttp: () => ({
          getRequest: () => ({
            method: 'POST',
            path: '/auth/change-password'
          })
        })
      };
      const allowed = guard.handleRequest(null, { id: 'u1', mustChangePassword: true }, null, contextAllowed);
      assert.equal(allowed.id, 'u1');
    }
  },
  {
    name: 'auth.service-login-payload-includes-session-version',
    run: async () => {
      let payloadSeen = null;
      const passwordHash = await bcrypt.hash('Senha#123', 10);
      const usersService = {
        findByEmail: async () => null,
        findById: async (id) => ({ id, passwordHash }),
        findAuthByEmail: async () => ({
          id: 'user-1',
          email: 'admin@laines.ufrn.br',
          passwordHash,
          role: 'admin',
          name: 'Admin',
          status: 'ativo',
          mustChangePassword: false,
          sessionVersion: 5
        }),
        updatePasswordAndRevokeSessions: async () => undefined,
        revokeAllSessions: async () => undefined
      };
      const jwtService = {
        signAsync: async (payload) => {
          payloadSeen = payload;
          return 'token-core-test';
        }
      };
      const loginAttempts = {
        assertNotBlocked: () => undefined,
        registerFailure: () => undefined,
        clear: () => undefined
      };
      const refreshTokens = {
        issue: async () => ({
          refreshToken: 'refresh-token-core-test',
          refreshTokenExpiresAt: new Date(Date.now() + 3600000)
        }),
        rotate: async () => ({
          kind: 'ok',
          userId: 'user-1',
          familyId: 'family-1',
          presentedSessionVersion: 5,
          refreshToken: 'refresh-token-core-test',
          refreshTokenExpiresAt: new Date(Date.now() + 3600000)
        }),
        revokeCurrent: async () => undefined,
        revokeFamilyForUser: async () => undefined,
        revokeAllForUser: async () => undefined
      };
      const authService = new AuthService(
        usersService,
        jwtService,
        loginAttempts,
        {
          get: (key) => {
            if (key === 'auth.passwordCompareConcurrency') return 2;
            if (key === 'auth.newAuthFlowEnabled') return false;
            if (key === 'auth.accessTokenExpiresIn') return '20m';
            if (key === 'jwt.issuer') return 'laines-api';
            if (key === 'jwt.audience') return 'laines-clients';
            return undefined;
          }
        },
        refreshTokens,
        undefined
      );

      const loginResult = await authService.login(
        { email: 'admin@laines.ufrn.br', password: 'Senha#123' },
        '127.0.0.1'
      );

      assert.equal(loginResult.accessToken, 'token-core-test');
      assert.equal(payloadSeen?.sv, 5);
      assert.equal(loginResult.user?.mustChangePassword, false);
    }
  },
  {
    name: 'observability.drill-enabled-flag',
    run: () => {
      const service = {
        simulateDrill: (scenario, samples) => ({ scenario, samples, ok: true })
      };

      const enabledController = new ObservabilityController(service, {
        get: (key) => (key === 'observability.drillEnabled' ? true : undefined)
      });
      const enabledResult = enabledController.drill('latency', 120);
      assert.equal(enabledResult.ok, true);
      assert.equal(enabledResult.scenario, 'latency');

      const disabledController = new ObservabilityController(service, {
        get: () => false
      });
      assert.throws(
        () => disabledController.drill('latency', 120),
        /OBSERVABILITY_DRILL_ENABLED=true/
      );
    }
  },
  {
    name: 'observability.persistence-cache-and-file',
    run: () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'laines-observability-test-'));
      const eventsFile = path.join(tempDir, 'events.jsonl');
      const config = {
        get: (key) => {
          const map = {
            'observability.persistenceEnabled': true,
            'observability.eventsFile': eventsFile,
            'observability.maxEventsFileBytes': 1024 * 1024,
            'observability.webhookUrl': '',
            'observability.webhookTimeoutMs': 1000,
            'observability.alertEvaluationIntervalMs': 1,
            'observability.alertEvaluationMinRequests': 1
          };
          return map[key];
        }
      };
      const service = new ObservabilityService(config, undefined);
      service.recordError({
        timestamp: new Date().toISOString(),
        path: '/tests',
        method: 'GET',
        statusCode: 500,
        message: 'forced error'
      });
      for (let index = 0; index < 15; index += 1) {
        service.recordRequest({
          method: 'GET',
          path: '/analytics/reports/overview',
          statusCode: 500,
          durationMs: 120
        });
      }

      const persistedErrors = service.getPersistedEvents(10, 'error');
      const persistedAlerts = service.getPersistedEvents(20, 'alert');
      assert.ok(persistedErrors.length >= 1);
      assert.ok(persistedAlerts.some((item) => item?.payload?.key === 'error_rate_5xx'));
      assert.equal(fs.existsSync(eventsFile), true);
      const fileContent = fs.readFileSync(eventsFile, 'utf8');
      assert.ok(fileContent.includes('"type":"error"'));
      assert.ok(fileContent.includes('"type":"alert"'));
    }
  },
  {
    name: 'calculation.hydration-core-metrics',
    run: () => {
      const result = calculateHydrationEvaluation({
        pesoAntesExercicio: 70,
        pesoAposExercicio: 68.9,
        duracaoExercicioMin: 60,
        volumeIngeridoMl: 500,
        volumeUrinarioMl: 100
      });

      assert.equal(Number(result.metrics.perdaPesoAbsolutaKg.toFixed(3)), 1.1);
      assert.equal(Number(result.metrics.perdaPesoPercentual.toFixed(2)), 1.57);
      assert.equal(Math.round(result.metrics.perdaHidricaLiquidaMl), 1500);
      assert.equal(Number(result.metrics.taxaSudoreseLh.toFixed(2)), 1.5);
      assert.equal(result.classification.label, 'Leve desidratacao');
      assert.equal(result.warnings.length, 0);
    }
  },
  {
    name: 'calculation.hydration-invalid-input-warnings',
    run: () => {
      const result = calculateHydrationEvaluation({
        pesoAntesExercicio: 70,
        pesoAposExercicio: 71,
        duracaoExercicioMin: 0
      });

      assert.equal(result.classification.label, 'Sem perda relevante');
      assert.ok(result.warnings.some((item) => /maior que o peso antes/i.test(item)));
      assert.ok(result.warnings.some((item) => /Duracao do exercicio deve ser maior que zero/i.test(item)));
      assert.ok(result.warnings.some((item) => /Balanco hidrico liquido negativo/i.test(item)));
    }
  },
  {
    name: 'calculation.nova-distribution-and-classification',
    run: () => {
      const result = calculateNovaEvaluation({
        kcalInNatura: 400,
        kcalMinimamenteProcessados: 300,
        kcalProcessados: 200,
        kcalUltraprocessados: 100
      });

      assert.equal(result.totals.totalDiario, 1000);
      assert.equal(result.percentuais.in_natura, 40);
      assert.equal(result.percentuais.minimamente_processados, 30);
      assert.equal(result.percentuais.processados, 20);
      assert.equal(result.percentuais.ultraprocessados, 10);
      assert.equal(result.classification.label, 'Padrao moderado');
      assert.equal(result.warnings.length, 0);
    }
  },
  {
    name: 'calculation.nova-empty-and-inconsistency-warnings',
    run: () => {
      const empty = calculateNovaEvaluation({});
      assert.ok(empty.warnings.some((item) => /Sem kcal por grupo NOVA e sem kcal total informado/i.test(item)));

      const mismatch = calculateNovaEvaluation({
        kcalTotalInformado: 1500,
        kcalInNatura: 300
      });
      assert.equal(mismatch.totals.totalDiarioCalculado, 300);
      assert.equal(mismatch.totals.inconsistenciaKcal, 1200);
      assert.equal(mismatch.percentuais.in_natura, 100);
      assert.equal(mismatch.percentuaisSobreTotalInformado.in_natura, 20);
      assert.ok(mismatch.warnings.some((item) => /Diferenca relevante entre total informado e soma dos grupos NOVA/i.test(item)));
    }
  },
  {
    name: 'calculation.laboratory-classification-and-counts',
    run: () => {
      const result = calculateLaboratoryEvaluation({
        painel: 'lipidograma',
        analitos: [
          { nome: 'LDL', valor: 151, referenciaMin: 0, referenciaMax: 129, unidade: 'mg/dL' },
          { nome: 'HDL', valor: 45, referenciaMin: 40, referenciaMax: 60, unidade: 'mg/dL' }
        ],
        previousAnalitos: [
          { nome: 'LDL', valor: 170 },
          { nome: 'HDL', valor: 41 }
        ]
      });

      assert.equal(result.classifications.statusPainel, 'alterado');
      assert.equal(result.calculated.alteracoesCount, 1);
      assert.equal(result.calculated.normaisCount, 1);
      assert.equal(result.inputNormalized.analitos.length, 2);
      assert.equal(result.inputNormalized.analitos[0].variacao.deltaAbs, -19);
    }
  },
  {
    name: 'calculation.evolution-score-and-priority',
    run: () => {
      const result = calculateEvolutionReturnEvaluation({
        adesaoPlanoAlimentar: 80,
        adesaoAtividadeFisica: 70,
        respostaPercebida: 4,
        objetivos: ['emagrecimento']
      });

      assert.equal(Number(result.calculated.scoreAdesaoGeral.toFixed(2)), 75.75);
      assert.equal(result.classifications.prioridadeRetorno, 'baixa');
      assert.equal(Array.isArray(result.calculated.resumoObjetivos), true);
      assert.equal(result.calculated.resumoObjetivos.length, 1);
    }
  },
  {
    name: 'avaliacoes.exames-laboratoriais-normalizer-canonical-shape',
    run: () => {
      const payload = normalizeExamesLaboratoriaisPayload({
        tipo: 'exames_laboratoriais',
        dados: {
          painel: 'glicemia',
          analitos: [
            { nome: 'Glicose', valor: '108', referenciaMin: '70', referenciaMax: '99', unidade: 'mg/dL' }
          ]
        },
        resultados: {}
      });

      assert.equal(payload?.dados?.dados_brutos?.painel, 'glicemia');
      assert.equal(Array.isArray(payload?.dados?.dados_brutos?.analitos), true);
      assert.equal(payload?.dados?.resultados_calculados?.alteracoesCount, 1);
      assert.equal(payload?.dados?.classificacoes?.statusPainel, 'alterado');
      assert.equal(payload?.formulaId, 'lab_ref_range_v1');
      assert.equal(payload?.formulaVersion, '1.0.0');
    }
  },
  {
    name: 'avaliacoes.evolucao-retorno-normalizer-canonical-shape',
    run: () => {
      const payload = normalizeEvolucaoRetornoPayload({
        tipo: 'evolucao_retorno',
        dados: {
          adesaoPlanoAlimentar: '60',
          adesaoAtividadeFisica: '40',
          respostaPercebida: '3',
          sintomas: 'fadiga recorrente'
        },
        resultados: {}
      });

      assert.equal(payload?.dados?.resultados_calculados?.scoreAdesaoGeral, 51.5);
      assert.equal(payload?.dados?.classificacoes?.prioridadeRetorno, 'alta');
      assert.equal(payload?.formulaId, 'evolucao_adesao_score_v1');
      assert.equal(payload?.formulaVersion, '1.0.0');
    }
  },
  {
    name: 'avaliacoes.dobras-cutaneas-normalizer-canonical-shape',
    run: () => {
      const payload = normalizeDobrasCutaneasPayload({
        tipo: 'dobras_cutaneas',
        dados: {
          protocoloDobras: 'jackson_pollock_7',
          sexo: 'male',
          dobras: {
            peitoral: '10.5',
            abdominal: '14.2'
          },
          resultados_calculados: {
            percentual_gordura: '18.2',
            massa_magra_kg: '56.1'
          }
        },
        resultados: {}
      });

      assert.equal(payload?.dados?.protocolo, 'jackson_pollock_7');
      assert.equal(payload?.dados?.dobras?.peitoral, 10.5);
      assert.equal(payload?.dados?.resultados_calculados?.percentualGordura, 18.2);
      assert.equal(payload?.dados?.resultados_calculados?.massaMagra, 56.1);
      assert.equal(String(payload?.formulaId).startsWith('jackson_pollock_7-'), true);
    }
  },
  {
    name: 'avaliacoes.perimetros-normalizer-canonical-shape',
    run: () => {
      const payload = normalizePerimetrosPayload({
        tipo: 'perimetros',
        dados: {
          peso_kg: '80',
          estatura_cm: '180',
          cintura_cm: '90',
          foco_cardiometabolico: true,
          resultados_calculados: {
            imc: '24.69',
            indiceCinturaEstatura: '0.5'
          },
          classificacoes: {
            imc: 'Eutrofia'
          }
        },
        resultados: {}
      });

      assert.equal(payload?.dados?.peso, 80);
      assert.equal(payload?.dados?.estatura, 1.8);
      assert.equal(payload?.dados?.resultados_calculados?.indice_cintura_estatura, 0.5);
      assert.equal(payload?.resultados?.calculated?.imc, 24.69);
      assert.equal(payload?.resultados?.output?.imc, 'Eutrofia');
    }
  },
  {
    name: 'avaliacoes.composicao-integrada-normalizer-canonical-shape',
    run: () => {
      const payload = normalizeComposicaoCorporalIntegradaPayload({
        tipo: 'composicao_corporal_integrada',
        dados: {
          fonte_oficial: 'perimetros',
          resultados_calculados: {
            percentualGorduraOficial: '21.8',
            massaMagraOficialKg: '54.2',
            tmbSelecionadaKcal: '1620',
            getEstimadoKcal: '2511'
          }
        },
        resultados: {}
      });

      assert.equal(payload?.dados?.fonte_oficial, 'perimetros');
      assert.equal(payload?.dados?.percentualGorduraOficial, 21.8);
      assert.equal(payload?.dados?.massaMagraOficialKg, 54.2);
      assert.equal(payload?.dados?.tmbSelecionadaKcal, 1620);
      assert.equal(payload?.resultados?.tmb_kcal, 1620);
    }
  },
  {
    name: 'avaliacoes.gasto-energetico-total-normalizer-canonical-shape',
    run: () => {
      const payload = normalizeGastoEnergeticoTotalPayload({
        tipo: 'gasto_energetico_total',
        dados: {
          resultados_calculados: {
            tmbBaseKcal: '1500',
            fatorAtividade: '1.6'
          },
          classificacoes: {
            alertaIngestaoIntensa: false
          }
        },
        resultados: {}
      });

      assert.equal(payload?.dados?.resultados_calculados?.tmbBaseKcal, 1500);
      assert.equal(payload?.dados?.resultados_calculados?.fatorAtividade, 1.6);
      assert.equal(payload?.dados?.resultados_calculados?.getEstimadoKcal, 2400);
      assert.equal(payload?.resultados?.get_kcal, 2400);
      assert.equal(payload?.formulaId, 'mifflin_st_jeor_1990');
    }
  },
  {
    name: 'avaliacoes.alimentar-normalizer-canonical-shape',
    run: () => {
      const payload = normalizeAvaliacaoAlimentarPayload({
        tipo: 'alimentar',
        dados: {
          kcalInNatura: '400',
          kcalMinimamenteProcessados: '300',
          kcalProcessados: '200',
          kcalUltraprocessados: '100'
        },
        resultados: {}
      });

      assert.equal(payload?.dados?.categorias?.in_natura, 400);
      assert.equal(payload?.dados?.categorias?.ultraprocessados, 100);
      assert.equal(payload?.dados?.totalDiarioCalculado, 1000);
      assert.equal(payload?.resultados?.percentuais?.ultraprocessados, 10);
      assert.equal(payload?.classificacao, 'Padrao moderado');
    }
  },
  {
    name: 'avaliacoes.hidratacao-normalizer-canonical-shape',
    run: () => {
      const payload = normalizeHidratacaoPayload({
        tipo: 'hidratacao',
        dados: {
          pesoAntesExercicio: '70',
          pesoAposExercicio: '68.9',
          duracaoExercicioMin: '60',
          volumeIngeridoMl: '500',
          volumeUrinarioMl: '100'
        },
        resultados: {}
      });

      assert.equal(payload?.dados?.perdaPesoAbsolutaKg, 1.1);
      assert.equal(payload?.dados?.perdaPesoPercentual, 1.57);
      assert.equal(payload?.dados?.perdaHidricaLiquidaMl, 1500);
      assert.equal(payload?.resultados?.output?.classificacaoHidrica, 'Leve desidratacao');
    }
  },
  {
    name: 'avaliacoes.socioeconomica-normalizer-canonical-shape',
    run: () => {
      const payload = normalizeAvaliacaoSocioeconomicaPayload({
        tipo: 'avaliacao_socioeconomica',
        dados: {
          temMenores: false,
          respostas: {
            q1: true,
            q2: true,
            q3: false,
            q4: false,
            q5: false,
            q6: false,
            q7: false,
            q8: false
          }
        },
        resultados: {}
      });

      assert.equal(payload?.dados?.temMenores, false);
      assert.equal(payload?.dados?.respostas?.q1, true);
      assert.equal(payload?.pontuacaoEBIA, 2);
      assert.equal(payload?.classificacao, 'IL');
      assert.match(payload?.classificacaoLabel || '', /Leve/i);
    }
  },
  {
    name: 'avaliacoes.fisioterapia-normalizer-canonical-shape',
    run: () => {
      const payload = normalizeFisioterapiaPayload({
        tipo: 'fisioterapia',
        dados: {
          queixaPrincipal: 'Dor lombar',
          intensidadeDor: '7',
          mobilidade: 'Limitada'
        }
      });

      assert.equal(payload?.dados?.queixaPrincipal, 'Dor lombar');
      assert.equal(payload?.dados?.intensidadeDor, 7);
      assert.equal(payload?.formulaId, 'fisioterapia_funcional_basica');
    }
  },
  {
    name: 'avaliacoes.psicologia-normalizer-canonical-shape',
    run: () => {
      const payload = normalizePsicologiaPayload({
        tipo: 'psicologia',
        dados: {
          objetivo: 'Reduzir ansiedade',
          estresse: '6',
          sono: 'Regular'
        }
      });

      assert.equal(payload?.dados?.objetivo, 'Reduzir ansiedade');
      assert.equal(payload?.dados?.estresse, 6);
      assert.equal(payload?.formulaId, 'psicologia_triagem_emocional');
    }
  },
  {
    name: 'avaliacoes.meta-uses-registry-and-carga-required-current-load',
    run: () => {
      const pacienteUtilsSource = fs.readFileSync(
        path.resolve('src/contexts/paciente/pacienteUtils.js'),
        'utf8'
      );
      const frontendRegistrySource = fs.readFileSync(
        path.resolve('src/constants/evaluationRegistry.js'),
        'utf8'
      );
      const backendRegistrySource = fs.readFileSync(
        path.resolve('server/src/avaliacoes/evaluation-registry.ts'),
        'utf8'
      );
      const avaliacaoCompletaSource = fs.readFileSync(
        path.resolve('src/views/AvaliacaoCompleta.jsx'),
        'utf8'
      );
      const triagemRedsSource = fs.readFileSync(
        path.resolve('src/views/avaliacoes/AvaliacaoTriagemREDS.jsx'),
        'utf8'
      );
      const triagemRedsNormalizerSource = fs.readFileSync(
        path.resolve('server/src/avaliacoes/normalizers/triagem-reds-normalizer.ts'),
        'utf8'
      );
      const dashboardAvaliacoesSource = fs.readFileSync(
        path.resolve('src/components/Prontuario/DashboardAvaliacoes.jsx'),
        'utf8'
      );
      const avaliacaoContextSource = fs.readFileSync(
        path.resolve('src/contexts/paciente/PacienteAvaliacaoContext.jsx'),
        'utf8'
      );
      const readSources = (dir) => fs.readdirSync(dir, { withFileTypes: true })
        .flatMap((entry) => {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) return readSources(fullPath);
          if (!/\.(js|jsx)$/.test(entry.name)) return [];
          return fs.readFileSync(fullPath, 'utf8');
        });
      const frontendSources = readSources(path.resolve('src')).join('\n');
      const autosaveSources = [
        'src/views/avaliacoes/AvaliacaoTriagemREDS.jsx',
        'src/views/avaliacoes/AvaliacaoCargaTreino.jsx',
        'src/views/avaliacoes/AvaliacaoAlimentar.jsx',
        'src/components/Avaliacoes/avaliacao-hidratacao/AvaliacaoHidratacao.jsx',
        'src/components/Avaliacoes/anamnese/AnamneseInicialForm.jsx',
        'src/components/Avaliacoes/clinica/AvaliacaoClinicaForm.jsx',
        'src/components/Avaliacoes/Antropometria/BioimpedanciaForm.jsx',
        'src/components/Avaliacoes/Antropometria/ComposicaoCorporalIntegradaForm.jsx',
        'src/components/Avaliacoes/Antropometria/DobrasCutaneasForm.jsx',
        'src/components/Avaliacoes/Antropometria/GastoEnergeticoTotalForm.jsx',
        'src/components/Avaliacoes/Antropometria/PerimetrosCorporaisForm.jsx',
        'src/components/Avaliacoes/avaliacao-alimentar/AvaliacaoAlimentarNOVA.jsx',
        'src/components/Avaliacoes/avaliacao-exames-laboratoriais/AvaliacaoExamesLaboratoriais.jsx',
        'src/components/Avaliacoes/avaliacao-evolucao-retorno/AvaliacaoEvolucaoRetorno.jsx',
        'src/components/Avaliacoes/avaliacao-socioeconomica/AvaliacaoSocioeconomica.jsx',
        'src/components/Avaliacoes/components/AvaliacaoTextual.jsx'
      ].map((file) => fs.readFileSync(path.resolve(file), 'utf8')).join('\n');

      assert.match(pacienteUtilsSource, /EVALUATION_REGISTRY_BY_TYPE/);
      assert.doesNotMatch(pacienteUtilsSource, /const requiredByTipo = \{/);
      assert.match(
        frontendRegistrySource,
        /type:\s*'carga_treino'[\s\S]*requiredFields:\s*\['faseAtual', 'sessoesSemana', 'cargaSemanaAtual'\]/
      );
      assert.match(
        backendRegistrySource,
        /tipo:\s*'carga_treino'[\s\S]*requiredFields:\s*\['faseAtual', 'sessoesSemana', 'cargaSemanaAtual'\]/
      );
      assert.match(avaliacaoCompletaSource, /activeSessionId/);
      assert.match(avaliacaoCompletaSource, /isInPinnedSession/);
      assert.doesNotMatch(avaliacaoCompletaSource, /status\s*===\s*'rascunho'\s*\?\s*55/);
      assert.match(avaliacaoCompletaSource, /getModuleFinalizationBlocker/);
      assert.match(avaliacaoCompletaSource, /isRedsQuestionnaireComplete/);
      assert.match(triagemRedsSource, /ingestaoKcalR24hAuto/);
      assert.match(triagemRedsSource, /gastoExercicioKcalAuto/);
      assert.match(triagemRedsSource, /massaMagraKgAuto/);
      assert.match(triagemRedsNormalizerSource, /ingestaoKcalR24hAuto/);
      assert.match(triagemRedsNormalizerSource, /gastoExercicioKcalAuto/);
      assert.match(triagemRedsNormalizerSource, /massaMagraKgAuto/);
      assert.match(
        dashboardAvaliacoesSource,
        /\['finalizada', 'concluida', 'realizada'\]\.includes\(token\)/
      );
      assert.doesNotMatch(
        autosaveSources,
        /autoSaveRef\.current\s*=\s*setTimeout[\s\S]{0,180},\s*(900|1000|1100)\)/
      );
      assert.doesNotMatch(frontendSources, /components\/avaliacoes/);
      assert.match(avaliacaoContextSource, /wouldReopenFinalized/);
      assert.match(avaliacaoContextSource, /couldBePreviousSession/);
    }
  },
  {
    name: 'avaliacoes.service.create-finalizada-blocks-invalid-composicao-integrada',
    run: async () => {
      const { service } = createAvaliacaoServiceHarness();
      await assert.rejects(
        async () => service.create({
          tipo: 'composicao_corporal_integrada',
          status: 'finalizada',
          pacienteId: 'paciente-1',
          sessaoId: 'sessao-1',
          dados: {
            fonte_oficial: 'perimetros',
            resultados_calculados: {
              percentualGorduraOficial: 21.8,
              massaMagraOficialKg: 54.2
            }
          }
        }, {
          id: 'admin-1',
          role: 'admin',
          email: 'admin@teste.com',
          name: 'Admin Teste'
        }),
        /Composicao integrada exige fonte oficial/i
      );
    }
  },
  {
    name: 'avaliacoes.service.create-finalizada-blocks-invalid-get',
    run: async () => {
      const { service } = createAvaliacaoServiceHarness();
      await assert.rejects(
        async () => service.create({
          tipo: 'gasto_energetico_total',
          status: 'finalizada',
          pacienteId: 'paciente-1',
          sessaoId: 'sessao-1',
          dados: {
            resultados_calculados: {
              tmbBaseKcal: 1500
            }
          }
        }, {
          id: 'admin-1',
          role: 'admin',
          email: 'admin@teste.com',
          name: 'Admin Teste'
        }),
        /GET exige TMB base, fator de atividade e GET estimado validos/i
      );
    }
  },
  {
    name: 'avaliacoes.service.create-finalizada-blocks-invalid-alimentar',
    run: async () => {
      const { service } = createAvaliacaoServiceHarness();
      await assert.rejects(
        async () => service.create({
          tipo: 'alimentar',
          status: 'finalizada',
          pacienteId: 'paciente-1',
          sessaoId: 'sessao-1',
          dados: {
            categorias: {
              in_natura: 0,
              minimamente_processados: 0,
              processados: 0,
              ultraprocessados: 0
            }
          }
        }, {
          id: 'admin-1',
          role: 'admin',
          email: 'admin@teste.com',
          name: 'Admin Teste'
        }),
        /Avaliacao alimentar exige informar kcal consumidas nos grupos NOVA/i
      );
    }
  },
  {
    name: 'avaliacoes.service.create-finalizada-blocks-invalid-hidratacao',
    run: async () => {
      const { service } = createAvaliacaoServiceHarness();
      await assert.rejects(
        async () => service.create({
          tipo: 'hidratacao',
          status: 'finalizada',
          pacienteId: 'paciente-1',
          sessaoId: 'sessao-1',
          dados: {
            pesoAntesExercicio: 70,
            pesoAposExercicio: 69,
            duracaoExercicioMin: 0
          }
        }, {
          id: 'admin-1',
          role: 'admin',
          email: 'admin@teste.com',
          name: 'Admin Teste'
        }),
        /Hidratacao exige peso antes, peso apos e duracao de exercicio validos/i
      );
    }
  },
  {
    name: 'avaliacoes.service.create-finalizada-blocks-invalid-fisioterapia',
    run: async () => {
      const { service } = createAvaliacaoServiceHarness();
      await assert.rejects(
        async () => service.create({
          tipo: 'fisioterapia',
          status: 'finalizada',
          pacienteId: 'paciente-1',
          sessaoId: 'sessao-1',
          dados: {
            queixaPrincipal: '',
            intensidadeDor: 5
          }
        }, {
          id: 'admin-1',
          role: 'admin',
          email: 'admin@teste.com',
          name: 'Admin Teste'
        }),
        /Fisioterapia exige queixa principal e intensidade de dor \(0-10\)/i
      );
    }
  },
  {
    name: 'avaliacoes.service.create-finalizada-blocks-invalid-psicologia',
    run: async () => {
      const { service } = createAvaliacaoServiceHarness();
      await assert.rejects(
        async () => service.create({
          tipo: 'psicologia',
          status: 'finalizada',
          pacienteId: 'paciente-1',
          sessaoId: 'sessao-1',
          dados: {
            objetivo: 'Controle emocional',
            estresse: 11
          }
        }, {
          id: 'admin-1',
          role: 'admin',
          email: 'admin@teste.com',
          name: 'Admin Teste'
        }),
        /Psicologia exige objetivo e nivel de estresse \(0-10\)/i
      );
    }
  },
  {
    name: 'avaliacoes.service.create-finalizada-blocks-invalid-reds',
    run: async () => {
      const { service } = createAvaliacaoServiceHarness();
      await assert.rejects(
        async () => service.create({
          tipo: 'triagem_reds',
          status: 'finalizada',
          pacienteId: 'paciente-1',
          sessaoId: 'sessao-1',
          dados: {
            disponibilidadeEnergetica: 24,
            ingestaoKcalR24h: 1800,
            gastoExercicioKcal: 600,
            massaMagraKg: 50
          },
          resultados: {
            DE: 24,
            classificacaoDE: 'reds_estabelecido'
          }
        }, {
          id: 'admin-1',
          role: 'admin',
          email: 'admin@teste.com',
          name: 'Admin Teste'
        }),
        /Triagem de Disponibilidade Energetica exige disponibilidade energetica, score de rastreio e classificacao/i
      );
    }
  },
  {
    name: 'avaliacoes.service.create-finalizada-blocks-incomplete-reds-questionnaire',
    run: async () => {
      const { service } = createAvaliacaoServiceHarness();
      await assert.rejects(
        async () => service.create({
          tipo: 'triagem_reds',
          status: 'finalizada',
          pacienteId: 'paciente-1',
          sessaoId: 'sessao-1',
          dados: {
            sexoBiologico: 'feminino',
            disponibilidadeEnergetica: 24,
            scoreLeafQ: 1,
            classificacaoDE: 'reds_estabelecido',
            leafQRespostas: {
              leaf_q1: true
            }
          },
          resultados: {
            DE: 24,
            scoreLeafQ: 1,
            classificacaoDE: 'reds_estabelecido'
          }
        }, {
          id: 'admin-1',
          role: 'admin',
          email: 'admin@teste.com',
          name: 'Admin Teste'
        }),
        /LEAF-Q completo/i
      );
    }
  },
  {
    name: 'avaliacoes.service.create-finalizada-allows-complete-reds-questionnaire',
    run: async () => {
      const { service } = createAvaliacaoServiceHarness();
      const leafQRespostas = Object.fromEntries(
        Array.from({ length: 12 }, (_, index) => [`leaf_q${index + 1}`, false])
      );
      const saved = await service.create({
        tipo: 'triagem_reds',
        status: 'finalizada',
        pacienteId: 'paciente-1',
        sessaoId: 'sessao-1',
        dados: {
          sexoBiologico: 'feminino',
          disponibilidadeEnergetica: 46,
          scoreLeafQ: 0,
          classificacaoDE: 'otima',
          leafQRespostas
        },
        resultados: {
          DE: 46,
          scoreLeafQ: 0,
          classificacaoDE: 'otima'
        }
      }, {
        id: 'admin-1',
        role: 'admin',
        email: 'admin@teste.com',
        name: 'Admin Teste'
      });

      assert.equal(saved.tipo, 'triagem_reds');
      assert.equal(saved.status, 'finalizada');
      assert.equal(saved.classificacao, 'otima');
    }
  },
  {
    name: 'avaliacoes.service.create-finalizada-allows-carga-without-acwr-history',
    run: async () => {
      const { service } = createAvaliacaoServiceHarness();
      const saved = await service.create({
        tipo: 'carga_treino',
        status: 'finalizada',
        pacienteId: 'paciente-1',
        sessaoId: 'sessao-1',
        dados: {
          faseAtual: 'competicao',
          estrategiaTreinamento: 'ondulante',
          sessoesSemana: [
            { dia: 'segunda', tipo: 'corrida', duracaoMin: 60, pse: 5 }
          ]
        }
      }, {
        id: 'admin-1',
        role: 'admin',
        email: 'admin@teste.com',
        name: 'Admin Teste'
      });

      assert.equal(saved.tipo, 'carga_treino');
      assert.equal(saved.status, 'finalizada');
      assert.equal(saved.resultados?.cargaSemanaAtual, 300);
      assert.equal(saved.resultados?.acwr, null);
    }
  },
  {
    name: 'avaliacoes.service.create-blocks-duplicate-type-in-session',
    run: async () => {
      const { service } = createAvaliacaoServiceHarness({
        repoOverrides: {
          findOne: async ({ where }) => (
            where?.sessaoId === 'sessao-1' && where?.tipo === 'alimentar'
              ? { id: 'avaliacao-existente' }
              : null
          )
        }
      });

      await assert.rejects(
        async () => service.create({
          tipo: 'alimentar',
          status: 'rascunho',
          pacienteId: 'paciente-1',
          sessaoId: 'sessao-1',
          dados: {}
        }, {
          id: 'admin-1',
          role: 'admin',
          email: 'admin@teste.com',
          name: 'Admin Teste'
        }),
        /Ja existe uma avaliacao do tipo informado nesta sessao/i
      );
    }
  },
  {
    name: 'avaliacoes.service.create-allows-equipe-multi-author',
    run: async () => {
      const { service } = createAvaliacaoServiceHarness({
        pacienteOverrides: {
          equipeMultiIds: ['multi-aluno-1']
        }
      });
      const result = await service.create({
        tipo: 'fisioterapia',
        status: 'rascunho',
        pacienteId: 'paciente-1',
        sessaoId: 'sessao-multi-1',
        dados: {}
      }, {
        id: 'multi-aluno-1',
        role: 'aluno',
        curso: 'fisioterapia',
        email: 'multi@teste.com',
        name: 'Aluno Fisioterapia'
      });

      assert.equal(result.alunoId, 'multi-aluno-1');
      assert.equal(result.pacienteId, 'paciente-1');
    }
  },
  {
    name: 'avaliacoes.service.create-blocks-equipe-multi-author-outside-case-area',
    run: async () => {
      const { service } = createAvaliacaoServiceHarness({
        pacienteOverrides: {
          equipeMultiIds: ['multi-aluno-1'],
          equipeProfissional: [{
            userId: 'multi-aluno-1',
            userName: 'Aluno Multi',
            area: 'psicologia',
            papel: 'avaliador'
          }]
        }
      });

      await assert.rejects(
        async () => service.create({
          tipo: 'fisioterapia',
          status: 'rascunho',
          pacienteId: 'paciente-1',
          sessaoId: 'sessao-multi-area-1',
          dados: {}
        }, {
          id: 'multi-aluno-1',
          role: 'aluno',
          curso: 'fisioterapia',
          email: 'multi@teste.com',
          name: 'Aluno Fisioterapia'
        }),
        /Formulario restrito a area de atuacao do membro neste caso/i
      );
    }
  },
  {
    name: 'avaliacoes.service.create-athlete-blocks-unsafe-type',
    run: async () => {
      const { service } = createAvaliacaoServiceHarness();
      await assert.rejects(
        async () => service.create({
          tipo: 'bioimpedancia',
          pacienteId: 'paciente-1',
          sessaoId: 'sessao-1',
          dados: {}
        }, {
          id: 'atleta-1',
          role: 'atleta',
          email: 'atleta@teste.com',
          name: 'Atleta Teste'
        }),
        /Formulario nao liberado/
      );
    }
  },
  {
    name: 'avaliacoes.service.create-athlete-allows-safe-self-report-as-draft',
    run: async () => {
      const { service } = createAvaliacaoServiceHarness();
      const saved = await service.create({
        tipo: 'hidratacao',
        pacienteId: 'paciente-1',
        sessaoId: 'sessao-1',
        dados: {
          pesoAntesExercicio: 70,
          pesoAposExercicio: 69.4,
          duracaoExercicioMin: 60
        }
      }, {
        id: 'atleta-1',
        role: 'atleta',
        email: 'atleta@teste.com',
        name: 'Atleta Teste'
      });

      assert.equal(saved.tipo, 'hidratacao');
      assert.equal(saved.status, 'rascunho');
      assert.equal(saved.alunoId, 'aluno-1');
      assert.equal(saved.meta?.origemPreenchimento, 'atleta');
      assert.equal(saved.meta?.atletaSelfReport, true);
      assert.equal(saved.meta?.aguardandoRevisao, true);
    }
  },
  {
    name: 'avaliacoes.service.create-athlete-allows-ebia-when-release-enabled',
    run: async () => {
      const { service } = createAvaliacaoServiceHarness();
      const saved = await service.create({
        tipo: 'avaliacao_socioeconomica',
        pacienteId: 'paciente-1',
        sessaoId: 'sessao-1',
        dados: {
          temMenores: false,
          respostas: {
            q1: false,
            q2: false,
            q3: false,
            q4: false,
            q5: false,
            q6: false,
            q7: false,
            q8: false
          }
        },
        pontuacaoEBIA: 0,
        classificacao: 'SA',
        classificacaoLabel: 'Seguranca Alimentar'
      }, {
        id: 'atleta-1',
        role: 'atleta',
        email: 'atleta@teste.com',
        name: 'Atleta Teste'
      });

      assert.equal(saved.tipo, 'avaliacao_socioeconomica');
      assert.equal(saved.status, 'finalizada');
      assert.equal(saved.alunoId, 'aluno-1');
      assert.equal(saved.pacienteId, 'paciente-1');
      assert.equal(saved.sessaoId, 'sessao-1');
    }
  },
  {
    name: 'avaliacoes.service.create-athlete-blocks-incomplete-ebia',
    run: async () => {
      const { service } = createAvaliacaoServiceHarness();
      await assert.rejects(
        async () => service.create({
          tipo: 'avaliacao_socioeconomica',
          pacienteId: 'paciente-1',
          sessaoId: 'sessao-1',
          dados: {
            temMenores: false,
            respostas: { q1: true }
          },
          pontuacaoEBIA: 1,
          classificacao: 'IL',
          classificacaoLabel: 'Inseguranca Alimentar Leve'
        }, {
          id: 'atleta-1',
          role: 'atleta',
          email: 'atleta@teste.com',
          name: 'Atleta Teste'
        }),
        /EBIA incompleta/
      );
    }
  },
  {
    name: 'avaliacoes.service.findall-requires-filter-for-athlete',
    run: async () => {
      const { service } = createAvaliacaoServiceHarness();
      await assert.rejects(
        async () => service.findAll(
          { id: 'atleta-1', role: 'atleta', email: 'atleta@teste.com', name: 'Atleta Teste' },
          {}
        ),
        /Perfil atleta deve informar pacienteId ou projetoId/
      );
    }
  },
  {
    name: 'avaliacoes.service.findall-admin-global-requires-limit',
    run: async () => {
      const { service } = createAvaliacaoServiceHarness();
      await assert.rejects(
        async () => service.findAll(
          { id: 'admin-1', role: 'admin', email: 'admin@teste.com', name: 'Admin Teste' },
          {}
        ),
        /Consultas administrativas sem filtros devem informar limit/
      );
    }
  },
  {
    name: 'avaliacoes.bioimpedancia-normalizer-maps-extended-fields',
    run: () => {
      const payload = normalizeBioimpedanciaPayload({
        tipo: 'bioimpedancia',
        dados: {
          percentual_gordura: '18.8',
          agua_total: '37.3',
          massa_magra: '51.2',
          bioresistencia: '488',
          reatancia: '61',
          alvo_percentual_gordura: '16.0',
          peso: '69.4'
        },
        resultados: {}
      });

      assert.equal(payload?.dados?.percentualGordura, 18.8);
      assert.equal(payload?.dados?.peso_gordura !== undefined, true);
      assert.equal(payload?.dados?.percentualAguaMassaMagra !== undefined, true);
      assert.equal(payload?.resultados?.taxa_metabolica_basal, payload?.dados?.taxaMetabolicaBasal);
      assert.equal(payload?.dados?.bioresistencia, 488);
      assert.equal(payload?.dados?.reatancia, 61);
      assert.equal(payload?.dados?.alvoPercentualGordura, 16);
    }
  },
  {
    name: 'plano-alimentar.validacao-clinica-blocks-missing-get',
    run: async () => {
      const { service } = createPlanoAlimentarServiceHarness();
      const result = await service.validarAtivacaoClinica({
        pacienteId: 'paciente-1',
        metaCalorica: 2200,
        metaCHOg: 250,
        metaPTNg: 120,
        metaLIPg: 70,
        metaFibrasg: 28,
        dados: {
          refeicoes: [{
            alimentos: [{
              descricao: 'Arroz',
              calorias: 300,
              cho: 60,
              ptn: 6,
              lip: 1,
              fibra: 4
            }]
          }],
          suplementos: [],
          revisaoFinal: { confirmada: true }
        }
      });

      assert.equal(result.podeAtivar, false);
      assert.match(result.bloqueios.join(' '), /GET cadastrado/);
    }
  },
  {
    name: 'plano-alimentar.validacao-clinica-blocks-risk-supplement-and-calculates-fiber',
    run: async () => {
      const { service } = createPlanoAlimentarServiceHarness({
        avaliacaoGet: {
          id: 'get-1',
          resultados: {
            getEstimadoKcal: 600,
            choG: 80,
            ptnG: 40,
            lipG: 20,
            fibrasG: 10
          },
          dados: {}
        }
      });
      const result = await service.validarAtivacaoClinica({
        pacienteId: 'paciente-1',
        dados: {
          refeicoes: [{
            alimentos: [{
              descricao: 'Feijao',
              calorias: 500,
              cho: 70,
              ptn: 30,
              lip: 10,
              fibra: 8
            }]
          }],
          suplementos: [{ nome: 'Cafeina', statusWADA: 'risco' }],
          revisaoFinal: { confirmada: true }
        }
      });

      assert.equal(result.podeAtivar, false);
      assert.equal(result.validacao.totaisPrescritos.fibra, 8);
      assert.match(result.bloqueios.join(' '), /justificativa clinica/);
    }
  },
  {
    name: 'plano-alimentar.access-allows-equipe-multi',
    run: async () => {
      const { service } = createPlanoAlimentarServiceHarness({
        pacienteOverrides: {
          equipeMultiIds: ['multi-aluno-1', 'multi-prof-1']
        }
      });

      await assert.doesNotReject(
        async () => service.assertCanAccessPaciente({ id: 'multi-aluno-1', role: 'aluno' }, 'paciente-1')
      );
      await assert.doesNotReject(
        async () => service.assertCanAccessPaciente({ id: 'multi-prof-1', role: 'profissional' }, 'paciente-1')
      );
      await assert.rejects(
        async () => service.assertCanAccessPaciente({ id: 'externo-1', role: 'aluno' }, 'paciente-1'),
        /Acesso negado/
      );
    }
  },
  {
    name: 'text-normalization.unicode-nfc',
    run: () => {
      const decomposedName = `Jo\u0061\u0303o`; // "Joa" + combining tilde
      const normalizedName = normalizeUnicodeText(decomposedName);
      assert.equal(normalizedName, 'Jo\u00E3o');

      const payload = {
        nome: `\uFEFFA\u0301lvaro`,
        nested: [{ observacao: `Cafe\u0301` }]
      };

      const normalized = normalizeDeepUnicode(payload);
      assert.equal(normalized.nome, '\u00C1lvaro');
      assert.equal(normalized.nested[0].observacao, 'Caf\u00E9');
    }
  }
,
  {
    name: 'prescricao.substitutoDeOutroGrupoNaoSomeDaTela',
    run: () => {
      // O profissional pode escolher qualquer alimento como substituto,
      // inclusive de outro grupo. Antes, o que nao tinha equivalencia
      // calculavel era filtrado fora e sumia logo depois de ser adicionado.
      const banana = catalogoPorId['taco-banana-prata'];
      const outroGrupo = CATALOGO.find((a) => a.grupo !== banana.grupo);
      const base = {
        id: 'i1', alimentoId: banana.id, medidaIdx: 0, quantidade: 1,
        nome: banana.nome, grupo: banana.grupo, ig: banana.ig,
        comp: banana.comp, medida: banana.medidas[0],
        substitutos: [{ alimentoId: outroGrupo.id, medidaIdx: 0, modo: 'auto' }]
      };

      const opcoes = opcoesDoItem(base, { grupos: GRUPOS, catalogoPorId });
      assert.equal(opcoes.length, 1, 'a escolha do profissional nao e descartada');
      const op = opcoes[0];
      assert.equal(op.alimentoId, outroGrupo.id);
      // Sem equivalencia, o desvio e null — nunca zero, que leria como exata.
      if (op.desvio !== null) {
        assert.ok(Number.isFinite(op.desvio), 'ou ha equivalencia, ou ela e null');
      }
      assert.ok(op.quantidade > 0, 'a opcao entra com quantidade utilizavel');

      // Alimento fora do catalogo carregado continua sendo o unico descarte.
      const semCatalogo = opcoesDoItem(
        { ...base, substitutos: [{ alimentoId: 'nao-existe', medidaIdx: 0, modo: 'auto' }] },
        { grupos: GRUPOS, catalogoPorId }
      );
      assert.equal(semCatalogo.length, 0);
    }
  },
  {
    name: 'prescricao.substituicaoPrescritaSobrepoeOCalculo',
    run: () => {
      // O profissional precisa poder prescrever a substituicao, nao so aceitar
      // a equivalencia calculada. Em modo fixo a quantidade e a dele, e o
      // desvio passa a medir o quanto essa escolha se afasta da equivalencia.
      const banana = catalogoPorId['taco-banana-prata'];
      const base = {
        id: 'i1', alimentoId: banana.id, medidaIdx: 0, quantidade: 1,
        nome: banana.nome, grupo: banana.grupo, ig: banana.ig,
        comp: banana.comp, medida: banana.medidas[0]
      };
      const outro = CATALOGO.find((a) => a.grupo === banana.grupo && a.id !== banana.id);

      // montarOpcao nao filtra por tolerancia — quem filtra e substitutosPara.
      // Aqui interessa o modo e a proporcionalidade, nao a qualidade do par.
      const automatica = montarOpcao(base, outro, 0, { grupos: GRUPOS });
      assert.equal(automatica.modo, 'auto');
      assert.ok(automatica.quantidade > 0);

      // Dobrar a quantidade prescrita tem de dobrar o que ela entrega.
      const dobro = montarOpcao(base, outro, 0, {
        grupos: GRUPOS, modo: 'fixa', quantidadeFixa: automatica.quantidade * 2
      });
      assert.equal(dobro.modo, 'fixa');
      assert.equal(dobro.quantidade, automatica.quantidade * 2);
      // Dobrar a quantidade dobra o que ela entrega do nutriente ancora, entao
      // o desvio sobe cerca de um alvo inteiro acima do automatico.
      assert.ok(dobro.desvio > automatica.desvio + 0.5, 'o desvio cresce com a quantidade prescrita');
      assert.equal(dobro.gramas, automatica.gramas * 2);

      // Mesmo prescrita, a opcao continua sendo alternativa: os deltas sao
      // contra o alimento original, e nada disso soma ao dia.
      assert.ok(Number.isFinite(dobro.deltaCho) || dobro.deltaCho === null);
    }
  },
  {
    name: 'prescricao.equivalenciaDesviaSoComMedidaCaseira',
    run: () => {
      // Com a medida em grama e passo fino, o arredondamento quase nao desvia:
      // a equivalencia sai em 100% e o selo nao informa nada. O desvio so
      // aparece quando a medida e caseira e a quantidade tem de ser redonda.
      const base = catalogoPorId['taco-banana-prata'];
      const emGrama = { ...base, medidas: [{ descricao: null, gramas: 1 }] };
      const alvo = {
        id: 'i1', alimentoId: base.id, medidaIdx: 0, quantidade: 1,
        nome: base.nome, grupo: base.grupo, ig: base.ig, comp: base.comp,
        medida: base.medidas[0]
      };
      const porGrama = montarOpcao(alvo, emGrama, 0, { grupos: GRUPOS, passo: 0.5 });
      assert.ok(Math.abs(porGrama.desvio) < 0.005, 'grama arredonda fino e quase nao desvia');

      const porMedida = montarOpcao(alvo, catalogoPorId['taco-maca-fuji'] ?? base, 0, { grupos: GRUPOS });
      assert.ok(porMedida === null || Number.isFinite(porMedida.desvio), 'desvio e numero ou a opcao nao existe');
    }
  },
  {
    name: 'prescricao.novaSaiDoTipoDoAlimento',
    run: () => {
      // `tipoAlimento` e o sinal mais direto e vence o grupo.
      assert.equal(novaDoAlimento({ tipoAlimento: 'Alimento in natura', grupo: 'Bebidas' }), 1);
      assert.equal(novaDoAlimento({ tipoAlimento: 'Alimento processado (ingrediente)' }), 2);
      assert.equal(novaDoAlimento({ tipoAlimento: 'Alimento processado pronto para consumo' }), 3);
      // Sem tipo, cai no grupo.
      assert.equal(novaDoAlimento({ grupo: 'Frutas e derivados' }), 1);
      assert.equal(novaDoAlimento({ grupo: 'Gorduras e óleos' }), 2);
      // "Bebidas" reune agua de coco e refrigerante: nao da para afirmar.
      assert.equal(novaDoAlimento({ grupo: 'Bebidas' }), null);
      assert.equal(novaDoAlimento({}), null);
    }
  },
  {
    name: 'prescricao.novaNaoDiluiOqueNaoSabe',
    run: () => {
      const item = (nova, kcal) => ({
        nova, quantidade: 1, medida: { gramas: 100 }, comp: { kcal }
      });
      // Metade da energia sem classificacao: a fatia desconhecida aparece
      // nomeada, em vez de ser distribuida entre os grupos conhecidos.
      const d = distribuicaoNova([item(1, 100), item(null, 100)]);
      assert.equal(Math.round(d.grupos[0].pct), 50);
      assert.equal(Math.round(d.semClassificacao.pct), 50);
      const somaConhecida = d.grupos.reduce((a, g) => a + g.pct, 0);
      assert.equal(Math.round(somaConhecida + d.semClassificacao.pct), 100);
    }
  },
  {
    name: 'prescricao.listaDeComprasNaoInflaComSubstituto',
    run: () => {
      const cat = {
        arroz: { id: 'arroz', nome: 'Arroz', grupo: 'Cereais e derivados' },
        macarrao: { id: 'macarrao', nome: 'Macarrão', grupo: 'Cereais e derivados' },
        frango: { id: 'frango', nome: 'Frango', grupo: 'Carnes e derivados' }
      };
      const lista = listaDeCompras([
        { itens: [
          { alimentoId: 'arroz', substitutos: [{ alimentoId: 'macarrao' }] },
          { alimentoId: 'frango', substitutos: [] }
        ] }
      ], cat);

      const mercearia = lista.find((c) => c.categoria === 'Mercearia');
      const acougue = lista.find((c) => c.categoria === 'Açougue e ovos');
      assert.equal(acougue.itens[0].nome, 'Frango', 'categoria vem do grupo');
      // O substituto entra marcado: quem nao vai trocar nao compra os dois.
      assert.equal(mercearia.itens.find((i) => i.nome === 'Macarrão').opcao, true);
      assert.equal(mercearia.itens.find((i) => i.nome === 'Arroz').opcao, false);
    }
  },
  {
    name: 'prescricao.substitutoQueTambemEAlimentoDeixaDeSerOpcao',
    run: () => {
      // Macarrao e substituto do arroz numa refeicao e alimento em outra:
      // precisa entrar na lista como compra de verdade.
      const cat = {
        arroz: { id: 'arroz', nome: 'Arroz', grupo: 'Cereais e derivados' },
        macarrao: { id: 'macarrao', nome: 'Macarrão', grupo: 'Cereais e derivados' }
      };
      const lista = listaDeCompras([
        { itens: [{ alimentoId: 'arroz', substitutos: [{ alimentoId: 'macarrao' }] }] },
        { itens: [{ alimentoId: 'macarrao', substitutos: [] }] }
      ], cat);
      const m = lista[0].itens.find((i) => i.nome === 'Macarrão');
      assert.equal(m.opcao, false);
    }
  },
  {
    name: 'prescricao.porcoesDeEquivalencia',
    run: () => {
      // 30 g de CHO disponivel com porcao de 15 g = 2 porcoes.
      const item = {
        grupo: 'Cereais e derivados', quantidade: 1, medida: { gramas: 100 },
        comp: { cho: 32, fibra: 2 }
      };
      assert.equal(porcoesDoItem(item, 'choDisponivel'), 2);
      // Meia porcao e a menor unidade prescrita.
      assert.equal(porcoesDoItem({ ...item, comp: { cho: 24, fibra: 2 } }, 'choDisponivel'), 1.5);
      // Hortalica tem porcao menor: 15 g de CHO viraria um prato de alface.
      assert.equal(porcaoDoGrupo('Verduras, hortaliças e derivados', 'choDisponivel'), 5);
      assert.equal(porcaoDoGrupo('Carnes e derivados', 'ptn'), 7);
      // Sem ancora nao ha porcao.
      assert.equal(porcoesDoItem(item, null), null);
      // Sem o nutriente informado tambem nao.
      assert.equal(porcoesDoItem({ ...item, comp: { cho: null, fibra: null } }, 'choDisponivel'), null);
    }
  },
  {
    name: 'prescricao.horarioSegueOTreino',
    run: () => {
      // Pre e pos-treino nao tem hora fixa: tem distancia do treino. Mudar o
      // treino tem de mover as duas juntas.
      const pre = { ancora: { ref: 'inicio', min: -90 } };
      const pos = { ancora: { ref: 'fim', min: 15 } };
      const fixa = { horarioFixo: '12:30' };

      const tarde = { inicio: '18:00', duracao: 90 };
      assert.equal(horarioDe(pre, tarde), '16:30');
      assert.equal(horarioDe(pos, tarde), '19:45');
      assert.equal(horarioDe(fixa, tarde), '12:30', 'refeicao fixa nao se move');

      const manha = { inicio: '06:00', duracao: 90 };
      assert.equal(horarioDe(pre, manha), '04:30');
      assert.equal(horarioDe(pos, manha), '07:45');

      // Sem treino definido nao ha horario ancorado — null, nao um palpite.
      assert.equal(horarioDe(pre, { inicio: null }), null);
      assert.equal(rotuloAncora(pre.ancora), '−1h30');
      assert.equal(rotuloAncora(pos.ancora), '+15min');
    }
  },
  {
    name: 'prescricao.horarioAncoradoAtravessaMeiaNoite',
    run: () => {
      // Treino as 05:00 com pre-treino 3h antes cai no dia anterior; o relogio
      // tem de dar a volta em vez de produzir hora negativa.
      assert.equal(horarioDe({ ancora: { ref: 'inicio', min: -360 } }, { inicio: '05:00', duracao: 60 }), '23:00');
      // E a ordenacao coloca quem nao tem horario no fim, sem quebrar.
      const ordem = ordenarPorHorario(
        [{ id: 'c', horarioFixo: null }, { id: 'a', horarioFixo: '20:00' }, { id: 'b', horarioFixo: '07:00' }],
        { inicio: '18:00', duracao: 60 }
      ).map((r) => r.id);
      assert.deepEqual(ordem, ['b', 'a', 'c']);
    }
  },
  {
    name: 'prescricao.analiseSemPesoNaoInventaGkg',
    run: () => {
      const porRefeicao = [{ id: 'r1', nome: 'Almoco', totais: { ptn: 40 } }];
      const itens = [{
        alimentoId: 'x', grupo: 'cereais', quantidade: 1, medida: { gramas: 100 },
        comp: { kcal: 130, sodio: 200, potassio: 400 }
      }];

      const comPeso = analisesDoPlano(itens, porRefeicao, 80);
      assert.equal(comPeso.proteinaPorRefeicao[0].gkg, 0.5);
      assert.equal(comPeso.naK, 0.5, 'razao sodio/potassio');
      assert.equal(comPeso.densidadeEnergetica, 1.3, 'kcal por grama');
      assert.equal(comPeso.alimentos, 1);

      // Paciente sem peso cadastrado: g/kg e desconhecido, nao zero.
      const semPeso = analisesDoPlano(itens, porRefeicao, null);
      assert.equal(semPeso.proteinaPorRefeicao[0].gkg, null);
      assert.equal(semPeso.proteinaPorRefeicao[0].ptn, 40, 'o total em grama continua valendo');
    }
  },
  {
    name: 'prescricao.planoLegadoAbreSemQuebrar',
    run: () => {
      // Payload real de um plano gravado pela tela antiga: sem `itens`, sem
      // `catalogo`, com `tacoId: null` e a composicao embutida no alimento.
      // Procurar o alimento por id devolvia nada e derrubava a tela inteira.
      const catalogo = {};
      const r = migrarRefeicao({
        id: 'r1', nome: 'Almoco', horario: '12:00',
        alimentos: [{
          descricao: 'Feijao, carioca, cozido', tacoId: null, quantidadeGramas: 100,
          calorias: 76, cho: 13.6, ptn: 4.8, lip: 0.5, fibra: 8.5, medidaCaseira: null
        }],
        substitutos: [{
          descricao: 'Feijao, preto, cozido', tacoId: null, quantidadeGramas: 100,
          calorias: 77, cho: 14, ptn: 4.5, lip: 0.5, fibra: 8.4, medidaCaseira: null
        }]
      }, 0, catalogo);

      assert.equal(Object.keys(catalogo).length, 2, 'alimento e substituto viram entradas de catalogo');
      assert.equal(r.itens.length, 1);
      // Com um unico alimento na refeicao, o substituto solto so pode trocar
      // aquele — o vinculo e leitura, nao invencao.
      assert.equal(r.itens[0].substitutos.length, 1);
      assert.equal(r.substitutosSemVinculo.length, 0);

      const calc = calcularPlano(
        { refeicoes: [r] },
        { kcal: 2500, cho: null, ptn: null, lip: null, peso: null },
        [],
        { catalogoPorId: catalogo }
      );
      assert.equal(Math.round(calc.dia.kcal), 76, 'total bate com o que o plano gravado dizia');
    }
  },
  {
    name: 'prescricao.legadoComVariosAlimentosNaoAdivinhaVinculo',
    run: () => {
      // Com dois alimentos, atribuir o substituto a um deles seria inventar.
      const catalogo = {};
      const r = migrarRefeicao({
        alimentos: [
          { descricao: 'Arroz', quantidadeGramas: 100, calorias: 128 },
          { descricao: 'Feijao', quantidadeGramas: 100, calorias: 76 }
        ],
        substitutos: [{ descricao: 'Macarrao', quantidadeGramas: 100, calorias: 158 }]
      }, 0, catalogo);
      assert.equal(r.itens.every((i) => i.substitutos.length === 0), true);
      assert.equal(r.substitutosSemVinculo.length, 1, 'fica guardado, sem vinculo inventado');
    }
  },
  {
    name: 'avaliacoes.pendencia-de-avaliacao-completa-pede-fechamento',
    run: async () => {
      // O texto "Anamnese inicial em rascunho (100%) -> Completar" vinha daqui,
      // nao do frontend: o painel prefere a lista do backend.
      const { AvaliacoesService } = require('../server/dist/avaliacoes/avaliacoes.service.js');

      const avaliacoes = [
        { id: 'v1', tipo: 'anamnese_inicial', status: 'rascunho', meta: { completude: 100 } },
        { id: 'v2', tipo: 'perimetros', status: 'rascunho', meta: { completude: 40 } },
        { id: 'v3', tipo: 'hidratacao', status: 'rascunho', meta: { completude: 100 } },
        { id: 'v4', tipo: 'psicologia', status: 'rascunho', meta: { completude: 10 } }
      ];

      const avaliacoesRepo = {
        find: async () => avaliacoes,
        createQueryBuilder: () => ({
          where: function () { return this; }, andWhere: function () { return this; },
          orderBy: function () { return this; }, getMany: async () => avaliacoes
        })
      };
      // O paciente precisa existir e ser acessivel; o resto do servico nao e
      // exercitado por findPendencias.
      const pacientesRepo = {
        findOne: async () => ({ id: 'paciente-1', nome: 'Teste', status: 'Ativo', deletedAt: null })
      };
      const vazio = { find: async () => [], findOne: async () => null };
      const svc = new AvaliacoesService(
        avaliacoesRepo, vazio, pacientesRepo, vazio, { emit() {} }
      );
      svc.recordQuery = () => {};

      const lista = await svc.findPendencias('paciente-1', { role: 'admin', uid: 'u1' });

      const anamnese = lista.find((p) => p.itemTipo === 'anamnese_inicial');
      assert.equal(anamnese.acao.label, 'Finalizar', 'completa pede fechamento');
      assert.equal(anamnese.tipo, 'avaliacao_pronta');
      assert.ok(!/rascunho/i.test(anamnese.mensagem), 'nao diz "em rascunho (100%)"');
      assert.equal(anamnese.avaliacaoId, 'v1', 'aponta qual avaliacao');

      // Nao-obrigatoria completa deixou de sumir.
      const hidratacao = lista.find((p) => p.itemTipo === 'hidratacao');
      assert.ok(hidratacao, 'antes ela nao gerava pendencia nenhuma');
      assert.equal(hidratacao.acao.label, 'Finalizar');

      // Incompleta continua pedindo preenchimento.
      const perimetros = lista.find((p) => p.itemTipo === 'perimetros');
      assert.equal(perimetros.acao.label, 'Completar');

      // Prontas vem primeiro.
      assert.equal(lista[0].severidade, 'pronta');
    }
  },
  {
    name: 'prontuario.umNumeroPorPergunta',
    run: () => {
      // A tela dizia 16 no selo da aba, 16 na faixa e 9 no painel para a mesma
      // pergunta, porque seis arquivos contavam por conta propria.
      const avaliacoes = [
        { id: 'a1', tipo: 'anamnese_inicial', status: 'rascunho', meta: { completude: 100 }, resultados: { x: 1 } },
        { id: 'a2', tipo: 'perimetros', status: 'rascunho', meta: { completude: 100 }, resultados: { x: 1 } },
        { id: 'a3', tipo: 'bioimpedancia', status: 'finalizada', meta: { completude: 100 }, resultados: { x: 1 } },
        { id: 'a4', tipo: 'hidratacao', status: 'rascunho', meta: { completude: 67 }, resultados: { x: 1 } },
        { id: 'a5', tipo: 'psicologia', status: 'rascunho', meta: { completude: 0 }, resultados: {} }
      ];
      const e = estadoDoProntuario({ avaliacoes, agendamentos: [], agora: new Date('2026-08-30') });

      assert.equal(e.avaliacoes.total, 5);
      assert.equal(e.avaliacoes.finalizadas, 1);
      assert.equal(e.avaliacoes.prontasParaFinalizar, 2, 'as duas em 100% e ainda abertas');
      assert.equal(e.avaliacoes.emAndamento, 2);
      // As tres parcelas cobrem o total sem sobra nem falta.
      assert.equal(
        e.avaliacoes.finalizadas + e.avaliacoes.prontasParaFinalizar + e.avaliacoes.emAndamento,
        e.avaliacoes.total
      );
      assert.equal(e.avaliacoes.semResultado, 1, 'registro sem resultado nenhum');
    }
  },
  {
    name: 'prontuario.completaNaoPedeParaSerCompletada',
    run: () => {
      // "Anamnese inicial em rascunho (100%) -> Completar" era o texto literal
      // da tela. Completa pede fechamento, nao preenchimento.
      const cheia = { id: 'a1', tipo: 'anamnese_inicial', status: 'rascunho', meta: { completude: 100 } };
      assert.equal(prontaParaFinalizar(cheia), true);
      assert.equal(estaFechada(cheia), false);

      const p = pendenciasDo({ avaliacoes: [cheia], agendamentos: [], agora: new Date('2026-08-30') });
      const dela = p.find((x) => x.avaliacaoId === 'a1');
      assert.equal(dela.acao, 'Finalizar', 'pede fechamento, nao preenchimento');
      assert.equal(dela.severidade, 'pronta');
      assert.equal(p.filter((x) => x.avaliacaoId === 'a1').length, 1, 'nao duplica');
    }
  },
  {
    name: 'prontuario.concluidaContaComoFechadaEmUmLugarSo',
    run: () => {
      // O backend so emite rascunho e finalizada, mas ha registros antigos em
      // `concluida`. Um unico ponto de leitura impede que a mesma avaliacao
      // seja pendente numa aba e pronta em outra.
      assert.equal(estaFechada({ status: 'concluida' }), true);
      assert.equal(estaFechada({ status: 'finalizada' }), true);
      assert.equal(estaFechada({ status: 'rascunho' }), false);
      assert.equal(estaFechada({}), false);
    }
  },
  {
    name: 'prontuario.divergenciaEAnunciadaSemEscolherLado',
    run: () => {
      const d = divergenciasDo({
        paciente: { comorbidadesPessoais: ['diabetes', 'hipertensao', 'tireoide'], comorbidadesFamiliares: [] },
        declarado: { diagnosticosPessoais: 'Nao', historicoFamiliar: 'Nao' }
      });
      assert.equal(d.length, 1, 'so o par que de fato diverge');
      assert.ok(d[0].declarado && d[0].registrado, 'os dois lados vao juntos');
      assert.ok(d[0].registrado.includes('diabetes'));

      assert.equal(divergenciasDo({
        paciente: { comorbidadesPessoais: ['diabetes'] },
        declarado: { diagnosticosPessoais: 'diabetes' }
      }).length, 0, 'concordancia nao vira alerta');
    }
  },
  {
    name: 'prontuario.semConsultaFuturaEPendencia',
    run: () => {
      const agora = new Date('2026-08-30T12:00:00Z');
      const semFuturo = pendenciasDo({
        avaliacoes: [], agora,
        agendamentos: [{ id: 'c1', scheduledDate: '2026-08-01', status: 'realizada' }]
      });
      assert.ok(semFuturo.some((x) => x.genero === 'sem_agendamento'));

      const comFuturo = pendenciasDo({
        avaliacoes: [], agora,
        agendamentos: [{ id: 'c2', scheduledDate: '2026-09-15', status: 'agendada' }]
      });
      assert.equal(comFuturo.some((x) => x.genero === 'sem_agendamento'), false);

      const cancelada = pendenciasDo({
        avaliacoes: [], agora,
        agendamentos: [{ id: 'c3', scheduledDate: '2026-09-15', status: 'cancelada' }]
      });
      assert.ok(cancelada.some((x) => x.genero === 'sem_agendamento'), 'cancelada nao e continuidade');
    }
  },
  {
    name: 'prescricao.metaAusenteNaoViraDeficit',
    run: () => {
      // Meta nula dava `0 / null` = NaN, que passava pela checagem de nulo e
      // era classificado como 'insuficiente' — a tela pintava barra vermelha
      // cheia onde nao havia meta nenhuma.
      const semMeta = { kcal: 3115, cho: null, ptn: null, lip: null, peso: null };
      const { macros } = calcularPlano(PLANO_INICIAL, semMeta, REFERENCIAS, { catalogoPorId });
      const cho = macros.find((m) => m.nutriente === 'cho');
      assert.equal(cho.percentual, null, 'sem meta nao ha percentual');
      assert.equal(
        situacaoAdequacao({ percentual: cho.percentual, direcao: cho.direcao, cobertura: cho.cobertura }),
        'sem-dado',
        'sem meta a situacao e sem-dado, nunca insuficiente'
      );
      // E a energia, que tem meta, continua sendo comparada.
      const kcal = macros.find((m) => m.nutriente === 'kcal');
      assert.ok(Number.isFinite(kcal.percentual) && kcal.percentual > 0, 'com meta e itens o percentual existe');

      // Plano sem item nenhum nao vale zero: ausencia de alimento nao e
      // ausencia de energia prescrita (CLI-07). Zero seria lido como deficit.
      const vazio = calcularPlano({ refeicoes: [] }, semMeta, REFERENCIAS, { catalogoPorId });
      const kcalVazio = vazio.macros.find((m) => m.nutriente === 'kcal');
      assert.equal(kcalVazio.valor, null, 'plano vazio nao tem valor conhecido');
      assert.equal(kcalVazio.percentual, null, 'sem valor nao ha percentual, mesmo havendo meta');
      assert.equal(
        situacaoAdequacao({ percentual: kcalVazio.percentual, direcao: kcalVazio.direcao, cobertura: kcalVazio.cobertura }),
        'sem-dado'
      );
    }
  },
  {
    name: 'prescricao.choDisponivel-sem-fibra-e-null',
    run: () => {
      // Carboidrato disponivel exige carboidrato E fibra. Sem fibra cadastrada
      // o resultado e null: devolver o carboidrato total inventaria um dado.
      const semFibra = { comp: comp({ kcal: 100, cho: 20 }), medida: { gramas: 100 }, quantidade: 1 };
      assert.equal(choDisponivel(semFibra), null);
      assert.equal(ancoraEm(semFibra.comp, 'choDisponivel', 100), null);

      const comFibra = { comp: comp({ kcal: 100, cho: 20, fibra: 5 }), medida: { gramas: 100 }, quantidade: 1 };
      assert.equal(choDisponivel(comFibra), 15);

      // Sem carboidrato disponivel nao ha carga glicemica, mesmo com IG
      // cadastrado: a carga e IG x CHO disponivel.
      assert.equal(cargaGlicemicaItem({ ...semFibra, ig: 60 }), null);
      assert.equal(cargaGlicemicaItem({ ...comFibra, ig: 60 }), 9);
    }
  },
  {
    name: 'prescricao.ig-ausente-fica-fora-da-media',
    run: () => {
      // Um alimento sem IG nao entra na media ponderada. Entrar como zero
      // puxaria o indice da refeicao para baixo e a faria parecer mais branda.
      const comIg = {
        ig: 51, quantidade: 1, medida: { gramas: 100 },
        comp: comp({ kcal: 100, cho: 30, fibra: 5 })
      };
      const semIg = {
        ig: null, quantidade: 1, medida: { gramas: 100 },
        comp: comp({ kcal: 100, cho: 30, fibra: 5 })
      };

      const soComIg = totaisRefeicao([comIg]);
      const misto = totaisRefeicao([comIg, semIg]);

      assert.equal(soComIg.igPonderado, 51);
      // Se o item sem IG entrasse como zero, a media cairia para 25,5.
      assert.equal(misto.igPonderado, 51);

      // E o carboidrato disponivel dele continua somando normalmente.
      assert.equal(misto.choDisponivel, 50);
    }
  },
  {
    name: 'prescricao.direcao-limite-inverte-o-julgamento',
    run: () => {
      // Tres semanticas distintas (CLI-06): limite de seguranca, meta
      // individual e referencia populacional. Passar de 100% significa coisas
      // diferentes em cada uma; verde nunca e "quanto mais, melhor".
      assert.equal(situacaoAdequacao({ percentual: 120, direcao: 'limite', cobertura: 1 }), 'excedido');
      assert.equal(situacaoAdequacao({ percentual: 80, direcao: 'limite', cobertura: 1 }), 'ok');

      // Meta individual: afastar-se do alvo para cima tambem e desvio.
      assert.equal(situacaoAdequacao({ percentual: 100, direcao: 'meta', cobertura: 1 }), 'ok');
      assert.equal(situacaoAdequacao({ percentual: 115, direcao: 'meta', cobertura: 1 }), 'atencao');
      assert.equal(situacaoAdequacao({ percentual: 130, direcao: 'meta', cobertura: 1 }), 'excedido');
      assert.equal(situacaoAdequacao({ percentual: 85, direcao: 'meta', cobertura: 1 }), 'atencao');
      assert.equal(situacaoAdequacao({ percentual: 50, direcao: 'meta', cobertura: 1 }), 'insuficiente');

      // Referencia populacional (RDA/AI) nao e meta nem limite: atingi-la nao
      // comprova adequacao individual, e ultrapassa-la nao e excesso.
      assert.equal(situacaoAdequacao({ percentual: 100, direcao: 'referencia', cobertura: 1 }), 'referencia-atingida');
      assert.equal(situacaoAdequacao({ percentual: 180, direcao: 'referencia', cobertura: 1 }), 'referencia-atingida');
      assert.equal(situacaoAdequacao({ percentual: 90, direcao: 'referencia', cobertura: 1 }), 'referencia-abaixo');

      // Cobertura baixa derruba o julgamento antes da direcao.
      assert.equal(situacaoAdequacao({ percentual: 120, direcao: 'limite', cobertura: 0.4 }), 'sem-dado');
      assert.equal(situacaoAdequacao({ percentual: null, direcao: 'meta', cobertura: 1 }), 'sem-dado');

      // E o calculo carrega a direcao para quem for decidir.
      const r = calcularPlano(PLANO_INICIAL, METAS, REFERENCIAS, { catalogoPorId });
      const sodio = r.micros.find((m) => m.nutriente === 'sodio');
      assert.equal(sodio.direcao, 'limite');
    }
  },
  {
    name: 'prescricao.arredondamento-antes-da-tolerancia',
    run: () => {
      // O candidato fecha exatamente no alvo se a quantidade puder ser
      // fracionaria, mas so existe em medida caseira de passo 0,5. Depois de
      // arredondar ele fica 19% fora — e nao pode ser oferecido.
      const grupos = { cereais: { rotulo: 'Cereais', ancora: 'choDisponivel' } };
      const base = {
        alimentoId: 'base', grupo: 'cereais', ig: null, quantidade: 1,
        medida: { gramas: 100 }, comp: comp({ kcal: 120, cho: 29.8, fibra: 5 })
      };
      const candidato = {
        id: 'cand', nome: 'Candidato', fonte: 'TESTE', grupo: 'cereais', ig: null,
        medidas: [{ descricao: 'porcao', gramas: 100 }],
        comp: comp({ kcal: 110, cho: 25, fibra: 5 })
      };
      const catalogo = [candidato];

      // alvo = 24,8 g de CHO disponivel; o candidato entrega 20 g por medida.
      assert.ok(Math.abs(ancoraEm(base.comp, 'choDisponivel', 100) - 24.8) < 1e-9);
      assert.equal(ancoraEm(candidato.comp, 'choDisponivel', 100), 20);

      // Sem arredondar (passo fino) ele fecha no alvo e e oferecido.
      const fino = substitutosPara(base, { grupos, catalogo, passo: 0.01 });
      assert.equal(fino.candidatos.length, 1);
      assert.ok(Math.abs(fino.candidatos[0].desvio) < 0.005);

      // Com medida caseira de 0,5 a quantidade cai para 1 e o desvio passa de 10%.
      const arredondado = montarOpcao(base, candidato, 0, { grupos, passo: 0.5 });
      assert.equal(arredondado.quantidade, 1);
      assert.ok(Math.abs(arredondado.desvio) > 0.1);

      // Por isso ele nao aparece na lista.
      const real = substitutosPara(base, { grupos, catalogo, passo: 0.5 });
      assert.deepEqual(real.candidatos, []);
    }
  },
  {
    name: 'prescricao.cobertura-cai-com-micronutriente-null',
    run: () => {
      // Tapioca nao tem ferro cadastrado. A cobertura precisa dizer que parte
      // da energia do conjunto nao tem o dado, em vez de somar zero e mentir.
      const banana = catalogoPorId['taco-banana-prata'];
      const tapioca = catalogoPorId['ibge-tapioca-goma'];
      assert.equal(tapioca.comp.ferro, null);

      const itemBanana = { ...banana, quantidade: 1, medida: banana.medidas[0] };
      const itemTapioca = { ...tapioca, quantidade: 1, medida: tapioca.medidas[0] };

      assert.equal(cobertura([itemBanana], 'ferro'), 1);

      const cob = cobertura([itemBanana, itemTapioca], 'ferro');
      assert.ok(cob < 1, 'cobertura deveria ser menor que 1, veio ' + cob);

      const kcalBanana = (banana.comp.kcal * 60) / 100;
      const kcalTapioca = (tapioca.comp.kcal * 25) / 100;
      assert.equal(cob, kcalBanana / (kcalBanana + kcalTapioca));
    }
  },
  {
    name: 'prescricao.substituto-nao-soma-ao-dia',
    run: () => {
      // Substituto e alternativa, nao acrescimo. Acrescentar opcoes a um item
      // nao pode mover nenhum total do dia.
      const semOpcoes = {
        ...PLANO_INICIAL,
        refeicoes: PLANO_INICIAL.refeicoes.map((r) => ({
          ...r, itens: r.itens.map((i) => ({ ...i, substitutos: [] }))
        }))
      };
      const comOpcoes = {
        ...PLANO_INICIAL,
        refeicoes: PLANO_INICIAL.refeicoes.map((r) => ({
          ...r,
          itens: r.itens.map((i) => ({
            ...i,
            substitutos: [{ alimentoId: 'taco-batata-doce', medidaIdx: 0, modo: 'auto' }]
          }))
        }))
      };

      const a = calcularPlano(semOpcoes, METAS, REFERENCIAS, { catalogoPorId });
      const b = calcularPlano(comOpcoes, METAS, REFERENCIAS, { catalogoPorId });

      assert.equal(a.dia.kcal, b.dia.kcal);
      assert.equal(a.dia.cho, b.dia.cho);
      assert.equal(a.dia.ptn, b.dia.ptn);
      assert.equal(a.dia.lip, b.dia.lip);
      assert.equal(a.dia.cargaGlicemica, b.dia.cargaGlicemica);
      assert.deepEqual(
        a.micros.map((m) => m.valor),
        b.micros.map((m) => m.valor)
      );
    }
  },
  {
    name: 'prescricao.equivalencia-ancorada-no-nutriente-do-grupo',
    run: () => {
      // Carnes ancoram em proteina. O substituto iguala a proteina, e a
      // caloria fica livre para divergir — trocar por caloria juntaria
      // alimentos de papel metabolico oposto.
      const frango = catalogoPorId['taco-frango-peito'];
      const base = {
        alimentoId: frango.id, grupo: 'carnes', ig: frango.ig, quantidade: 1,
        medida: frango.medidas[0], comp: frango.comp
      };
      const ovo = catalogoPorId['taco-ovo-cozido'];

      const op = montarOpcao(base, ovo, 0, { grupos: GRUPOS });
      assert.equal(op.ancora, 'ptn');

      const ptnBase = frango.comp.ptn;
      const ptnOpcao = (ovo.comp.ptn * op.gramas) / 100;
      assert.ok(Math.abs(ptnOpcao - ptnBase) / ptnBase <= 0.2, 'proteina deveria ficar proxima');

      // A caloria nao e o criterio: aqui ela diverge bastante.
      const kcalBase = frango.comp.kcal;
      const kcalOpcao = (ovo.comp.kcal * op.gramas) / 100;
      assert.ok(Math.abs(kcalOpcao - kcalBase) / kcalBase > 0.1, 'caloria nao ancora a troca');
    }
  },
  {
    name: 'prescricao.restricao-da-anamnese-exclui-candidato',
    run: () => {
      // Mamao esta nas restricoes do seed e nao pode ser oferecido como opcao.
      const banana = catalogoPorId['taco-banana-prata'];
      const base = {
        alimentoId: banana.id, grupo: 'frutas', ig: banana.ig, quantidade: 2,
        medida: banana.medidas[0], comp: banana.comp
      };

      const semRestricao = substitutosPara(base, { grupos: GRUPOS, catalogo: CATALOGO });
      const comRestricao = substitutosPara(base, {
        grupos: GRUPOS, catalogo: CATALOGO, restricoes: ['taco-mamao-papaia']
      });

      const temMamao = (r) => r.candidatos.some((c) => c.alimentoId === 'taco-mamao-papaia');
      assert.equal(temMamao(comRestricao), false);
      assert.ok(semRestricao.candidatos.length >= comRestricao.candidatos.length);
    }
  },
  {
    name: 'prescricao.restricao-conferida-por-grupo-suspende-sugestao',
    run: () => {
      // UPD-11: a conferencia registrada no plano pode restringir um grupo
      // inteiro; enquanto nao houver conferencia, nada e sugerido.
      const banana = catalogoPorId['taco-banana-prata'];
      const base = {
        alimentoId: banana.id, grupo: 'frutas', ig: banana.ig, quantidade: 2,
        medida: banana.medidas[0], comp: banana.comp
      };
      const pendente = substitutosPara(base, { grupos: GRUPOS, catalogo: CATALOGO, restricoes: { pendenteRevisao: true } });
      assert.equal(pendente.motivo, 'restricoes-pendentes');
      assert.equal(pendente.candidatos.length, 0);

      const grupoRestrito = substitutosPara(base, {
        grupos: GRUPOS, catalogo: CATALOGO, restricoes: { pendenteRevisao: false, grupos: ['frutas'], alimentoIds: [] }
      });
      assert.equal(grupoRestrito.motivo, 'grupo-restrito');
      assert.equal(grupoRestrito.candidatos.length, 0);

      const outroGrupo = substitutosPara(base, {
        grupos: GRUPOS, catalogo: CATALOGO, restricoes: { pendenteRevisao: false, grupos: ['leites'], alimentoIds: ['taco-mamao-papaia'] }
      });
      assert.equal(outroGrupo.motivo, null);
      assert.equal(outroGrupo.candidatos.some((c) => c.alimentoId === 'taco-mamao-papaia'), false);
      assert.ok(outroGrupo.candidatos.length > 0, 'grupo nao restrito continua com sugestoes');
    }
  }
,
  {
    name: 'prescricao.editar-quantidade-recalcula-tudo',
    run: () => {
      // Todo valor exibido e derivado; nenhum total e armazenado. Dobrar a
      // quantidade de um item precisa mover a refeicao, o dia, a distribuicao
      // da rosca e a adequacao — se algum ficar parado, ha total guardado.
      const dobrado = {
        ...PLANO_INICIAL,
        refeicoes: PLANO_INICIAL.refeicoes.map((r, i) => (
          i !== 0 ? r : { ...r, itens: r.itens.map((it, j) => (
            j !== 0 ? it : { ...it, quantidade: it.quantidade * 2 }
          )) }
        ))
      };

      const antes = calcularPlano(PLANO_INICIAL, METAS, REFERENCIAS, { catalogoPorId });
      const depois = calcularPlano(dobrado, METAS, REFERENCIAS, { catalogoPorId });

      // refeicao
      assert.ok(depois.porRefeicao[0].totais.kcal > antes.porRefeicao[0].totais.kcal);
      assert.ok(depois.porRefeicao[0].totais.cho > antes.porRefeicao[0].totais.cho);
      // dia
      assert.ok(depois.dia.kcal > antes.dia.kcal);
      assert.ok(depois.dia.cargaGlicemica > antes.dia.cargaGlicemica);
      // rosca
      const dAntes = distribuicaoEnergetica(antes.dia);
      const dDepois = distribuicaoEnergetica(depois.dia);
      assert.ok(dDepois.kcalMacros > dAntes.kcalMacros);
      assert.notEqual(dDepois.cho, dAntes.cho);
      // adequacao
      const ferroAntes = antes.micros.find((m) => m.nutriente === 'ferro');
      const ferroDepois = depois.micros.find((m) => m.nutriente === 'ferro');
      assert.ok(ferroDepois.valor > ferroAntes.valor);
      assert.ok(ferroDepois.percentual > ferroAntes.percentual);

      // As refeicoes que nao foram tocadas ficam exatamente iguais.
      assert.deepEqual(depois.porRefeicao[1].totais, antes.porRefeicao[1].totais);
    }
  },
  {
    name: 'prescricao.sodio-80-adequado-calcio-80-nao',
    run: () => {
      // Mesmo percentual, julgamentos opostos: sodio e limite (CDRR), calcio
      // e meta (RDA). Oitenta por cento do limite e folga; oitenta por cento
      // da meta e falta.
      const sodio = REFERENCIAS.find((r) => r.nutriente === 'sodio');
      const calcio = REFERENCIAS.find((r) => r.nutriente === 'calcio');
      assert.equal(sodio.direcao, 'limite');
      assert.equal(calcio.direcao, 'meta');

      assert.equal(situacaoAdequacao({ percentual: 80, direcao: sodio.direcao, cobertura: 1 }), 'ok');
      assert.notEqual(situacaoAdequacao({ percentual: 80, direcao: calcio.direcao, cobertura: 1 }), 'ok');
      assert.equal(situacaoAdequacao({ percentual: 80, direcao: calcio.direcao, cobertura: 1 }), 'atencao');

      // E acima de 100 o sinal se inverte de novo.
      assert.equal(situacaoAdequacao({ percentual: 110, direcao: sodio.direcao, cobertura: 1 }), 'excedido');
      assert.equal(situacaoAdequacao({ percentual: 110, direcao: calcio.direcao, cobertura: 1 }), 'ok');
    }
  }
];

let failures = 0;
for (const testCase of tests) {
  try {
    await testCase.run();
    console.log(`[core-test] ok: ${testCase.name}`);
  } catch (error) {
    failures += 1;
    console.error(`[core-test] fail: ${testCase.name}`);
    console.error(error instanceof Error ? error.message : String(error));
  }
}

if (failures > 0) {
  console.error(`[core-test] ${failures} teste(s) falharam.`);
  process.exitCode = 1;
} else {
  console.log('[core-test] todos os testes passaram.');
}
