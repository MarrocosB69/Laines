import 'reflect-metadata';
import { RequestMethod } from '@nestjs/common';
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  MODULE_METADATA,
  PATH_METADATA
} from '@nestjs/common/constants';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { AppModule } from '../src/app.module';
import { ROLES_KEY } from '../src/auth/roles.decorator';

type ModuleType = Function & { name?: string };
type ControllerType = Function & { prototype: Record<string, unknown>; name?: string };

type RouteRow = {
  method: string;
  route: string;
  guards: string;
  roles: string;
};

const toArray = <T>(value: T | T[] | undefined | null): T[] => {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
};

const normalizeSegment = (segment: unknown) => String(segment ?? '')
  .trim()
  .replace(/^\/+|\/+$/g, '');

const joinRoute = (controllerPath: string, methodPath: string) => {
  const parts = [controllerPath, methodPath]
    .map(normalizeSegment)
    .filter(Boolean);
  return `/${parts.join('/')}`.replace(/\/+/g, '/') || '/';
};

const guardName = (guard: unknown) => {
  if (typeof guard === 'function') return guard.name || 'anonymous';
  if (guard && typeof guard === 'object' && 'name' in guard) {
    return String((guard as { name?: string }).name || 'anonymous');
  }
  return String(guard || 'anonymous');
};

const collectModules = (moduleType: unknown, seen = new Set<unknown>()): ModuleType[] => {
  const resolvedModule = (
    moduleType
    && typeof moduleType === 'object'
    && 'module' in moduleType
  )
    ? (moduleType as { module?: unknown }).module
    : moduleType;

  if (typeof resolvedModule !== 'function' || seen.has(resolvedModule)) {
    return [];
  }

  seen.add(resolvedModule);
  const imports = toArray<unknown>(
    Reflect.getMetadata(MODULE_METADATA.IMPORTS, resolvedModule)
  );
  return [
    resolvedModule as ModuleType,
    ...imports.flatMap((imported) => collectModules(imported, seen))
  ];
};

const resolveRoles = (controller: ControllerType, handler: Function) => {
  const methodRoles = Reflect.getMetadata(ROLES_KEY, handler) as string[] | undefined;
  const classRoles = Reflect.getMetadata(ROLES_KEY, controller) as string[] | undefined;
  const roles = methodRoles ?? classRoles ?? [];
  return roles.length > 0 ? roles.join(', ') : '⚠️ sem restrição de role';
};

const resolveGuards = (controller: ControllerType, handler: Function) => {
  const classGuards = toArray<unknown>(Reflect.getMetadata(GUARDS_METADATA, controller));
  const methodGuards = toArray<unknown>(Reflect.getMetadata(GUARDS_METADATA, handler));
  const names = [...classGuards, ...methodGuards]
    .map(guardName)
    .filter(Boolean);
  return names.length > 0 ? Array.from(new Set(names)).join(', ') : 'nenhum';
};

const extractControllerRoutes = (controller: ControllerType): RouteRow[] => {
  const controllerPaths = toArray<string>(
    Reflect.getMetadata(PATH_METADATA, controller)
  );
  const prototype = controller.prototype;

  return Object.getOwnPropertyNames(prototype).flatMap((propertyName) => {
    if (propertyName === 'constructor') return [];

    const descriptor = Object.getOwnPropertyDescriptor(prototype, propertyName);
    if (!descriptor || typeof descriptor.value !== 'function') return [];

    const handler = descriptor.value;
    const requestMethod = Reflect.getMetadata(METHOD_METADATA, handler);
    if (requestMethod === undefined) return [];

    const method = RequestMethod[requestMethod] || String(requestMethod);
    const methodPaths = toArray<string>(Reflect.getMetadata(PATH_METADATA, handler));
    const classPaths = controllerPaths.length > 0 ? controllerPaths : [''];
    const handlerPaths = methodPaths.length > 0 ? methodPaths : [''];

    return classPaths.flatMap((controllerPath) => (
      handlerPaths.map((methodPath) => ({
        method,
        route: joinRoute(controllerPath, methodPath),
        guards: resolveGuards(controller, handler),
        roles: resolveRoles(controller, handler)
      }))
    ));
  });
};

const generate = () => {
  const modules = collectModules(AppModule);
  const controllers = Array.from(new Set(
    modules.flatMap((moduleType) => (
      toArray<ControllerType>(Reflect.getMetadata(MODULE_METADATA.CONTROLLERS, moduleType))
    ))
  ));

  const rows = controllers
    .flatMap(extractControllerRoutes)
    .sort((a, b) => `${a.route} ${a.method}`.localeCompare(`${b.route} ${b.method}`));

  const outputPath = resolve(__dirname, '..', '..', 'docs', 'rbac-matrix.md');
  const generatedAt = new Date().toISOString();
  const body = [
    '# Matriz RBAC',
    '',
    `Gerado automaticamente em ${generatedAt}.`,
    '',
    '| Método | Rota | Guards | Roles permitidos |',
    '| --- | --- | --- | --- |',
    ...rows.map((row) => (
      `| ${row.method} | \`${row.route}\` | ${row.guards} | ${row.roles} |`
    )),
    ''
  ].join('\n');

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, body, 'utf8');
  console.log(`[rbac-matrix] gerado: ${outputPath}`);
};

generate();
