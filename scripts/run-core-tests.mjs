import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
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
  isStudentMemberRole: isStudentMemberRoleServer,
  normalizeRole: normalizeRoleServer
} = require('../server/dist/auth/access-control.js');
const { RolesGuard } = require('../server/dist/auth/roles.guard.js');
const { JwtStrategy } = require('../server/dist/auth/jwt.strategy.js');
const { JwtAuthGuard } = require('../server/dist/auth/jwt-auth.guard.js');
const { AuthService } = require('../server/dist/auth/auth.service.js');
const { TarefasService } = require('../server/dist/tarefas/tarefas.service.js');
const { ProjetosService } = require('../server/dist/projetos/projetos.service.js');
const { UsersService } = require('../server/dist/users/users.service.js');
const { ObservabilityController } = require('../server/dist/observability/observability.controller.js');
const { ObservabilityService } = require('../server/dist/observability/observability.service.js');
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
    confirmacaoAtleta: {
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
    create: (payload) => ({ id: 'avaliacao-1', ...payload }),
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
      return null;
    }
  };
  const realtime = { emit: () => undefined };
  const service = new AvaliacoesService(repo, sessoesRepo, pacientesRepo, usersRepo, realtime, undefined, undefined);
  service.syncSessaoStatus = async () => undefined;
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
      assert.equal(getRedirectPathFromRole('diretoria_extensao'), '/admin');
      assert.equal(getRedirectPathFromRole('professor'), '/professor');
      assert.equal(getRedirectPathFromRole('aluno'), '/aluno');
      assert.equal(getRedirectPathFromRole('tecnico'), '/equipe');
      assert.equal(getRedirectPathFromRole('atleta'), '/atleta');
      assert.equal(getRedirectPathFromRole('desconhecido'), '/');
      assert.ok(ADMIN_AREA_ROLES.includes('coord_atendimento'));
      assert.ok(PROFESSOR_AREA_ROLES.includes('profissional'));
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
      assert.equal(hasGlobalAccess('diretoria_ensino'), true);
      assert.equal(hasGlobalAccess('aluno'), false);

      assert.equal(hasTeamScopedAccess('professor'), true);
      assert.equal(hasTeamScopedAccess('ALUNO'), false);

      assert.equal(isStudentMemberRoleServer('presidente'), true);
      assert.equal(isStudentMemberRoleServer('vice'), true);
      assert.equal(isStudentMemberRoleServer('professor'), false);
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

      await service.findAll({ role: 'aluno' }, {});
      assert.equal(andWhereCalls.length, 1);
      assert.match(andWhereCalls[0].clause, /assignedRole/);
      assert.deepEqual(andWhereCalls[0].params, { role: 'aluno', todos: 'todos' });
    }
  },
  {
    name: 'tarefas.service.findAll-filters',
    run: async () => {
      const andWhereCalls = [];
      const queryBuilder = {
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
    name: 'projetos.service.findAll-student-public-projection',
    run: async () => {
      let findOptions = null;
      const repo = {
        find: async (options) => {
          findOptions = options;
          return [{ id: 'proj-1', nome: 'Projeto Teste', status: 'planejamento' }];
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

      const service = new ProjetosService(repo, pacientesRepo, usersRepo, { emit: () => {} });
      const result = await service.findAll({ id: 'aluno-1', role: 'aluno' });
      assert.equal(Array.isArray(result), true);
      assert.equal(findOptions?.select?.id, true);
      assert.equal(findOptions?.select?.nome, true);
      assert.equal(findOptions?.select?.status, true);
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

      const service = new ProjetosService(repo, pacientesRepo, usersRepo, { emit: () => {} });
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
      const service = new ProjetosService(repo, pacientesRepo, usersRepo, { emit: () => {} });

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
        /professor supervisor/i
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
        usersService
      );

      const valid = await strategy.validate({
        sub: 'user-1',
        email: 'admin@laines.ufrn.br',
        role: 'admin',
        name: 'Admin',
        sv: 3
      });
      assert.equal(valid.id, 'user-1');
      assert.equal(valid.mustChangePassword, false);

      await assert.rejects(
        async () => strategy.validate({
          sub: 'user-1',
          email: 'admin@laines.ufrn.br',
          role: 'admin',
          name: 'Admin',
          sv: 1
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
    name: 'avaliacoes.service.create-athlete-blocks-non-ebia',
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
        /Atleta pode preencher apenas o formulario EBIA/
      );
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
