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
const bcrypt = require('../server/node_modules/bcryptjs');
const {
  normalizeUnicodeText,
  normalizeDeepUnicode
} = require('../server/dist/common/text-normalization.js');

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
