import { Injectable, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditoriaService } from '../auditoria/auditoria.service';
import {
  ADMIN_CONSOLE_DEFAULT_SETTINGS,
  ADMIN_CONSOLE_SETTINGS_KEYS,
  AdminConsoleSettings,
  normalizeAdminConsoleSettings,
  SETTINGS_AUDIT_ACTION,
  SETTINGS_AUDIT_ENTITY,
  SETTINGS_SCOPE_ADMIN_CONSOLE
} from './settings.constants';
import { SystemSetting } from './settings.entity';
import { UpdateAdminSettingsDto } from './dto/update-admin-settings.dto';

type SettingsActor = {
  id: string;
  email?: string;
  role?: string;
  name?: string;
};

type StoredSettingsResponse = {
  scope: string;
  settings: AdminConsoleSettings;
  updatedAt: string | null;
  updatedBy: Record<string, unknown> | null;
};

@Injectable()
export class SettingsService {
  private readonly cacheTtlMs = 15000;
  private cachedAdminConsoleSettings: { value: AdminConsoleSettings; expiresAt: number } | null = null;

  constructor(
    @InjectRepository(SystemSetting) private readonly repo: Repository<SystemSetting>,
    @Optional() private readonly auditoria?: AuditoriaService
  ) {}

  private readCache() {
    if (!this.cachedAdminConsoleSettings) return null;
    if (this.cachedAdminConsoleSettings.expiresAt <= Date.now()) {
      this.cachedAdminConsoleSettings = null;
      return null;
    }
    return this.cachedAdminConsoleSettings.value;
  }

  private writeCache(value: AdminConsoleSettings) {
    this.cachedAdminConsoleSettings = {
      value,
      expiresAt: Date.now() + this.cacheTtlMs
    };
  }

  private clearCache() {
    this.cachedAdminConsoleSettings = null;
  }

  private normalizeActor(actor?: SettingsActor) {
    if (!actor?.id) return null;
    return {
      id: String(actor.id || '').trim(),
      email: String(actor.email || '').trim().toLowerCase(),
      role: String(actor.role || '').trim().toLowerCase(),
      name: String(actor.name || '').trim()
    };
  }

  private toResponse(entity?: SystemSetting | null): StoredSettingsResponse {
    const normalized = normalizeAdminConsoleSettings(entity?.payload || {});
    this.writeCache(normalized);
    return {
      scope: SETTINGS_SCOPE_ADMIN_CONSOLE,
      settings: normalized,
      updatedAt: entity?.updatedAt ? entity.updatedAt.toISOString() : null,
      updatedBy: entity?.updatedBy || null
    };
  }

  async getAdminConsoleSettings() {
    const cached = this.readCache();
    if (cached) return cached;
    const stored = await this.repo.findOne({
      where: { scope: SETTINGS_SCOPE_ADMIN_CONSOLE }
    });
    return this.toResponse(stored).settings;
  }

  async getAdminConsoleSettingsWithMeta() {
    const stored = await this.repo.findOne({
      where: { scope: SETTINGS_SCOPE_ADMIN_CONSOLE }
    });
    return this.toResponse(stored);
  }

  async getSessionTimeoutMinutes() {
    const settings = await this.getAdminConsoleSettings();
    return settings.sessionTimeout;
  }

  async upsertAdminConsoleSettings(
    input: UpdateAdminSettingsDto,
    actor?: SettingsActor
  ) {
    const currentEntity = await this.repo.findOne({
      where: { scope: SETTINGS_SCOPE_ADMIN_CONSOLE }
    });
    const previous = normalizeAdminConsoleSettings(currentEntity?.payload || {});
    const incoming = input && typeof input === 'object'
      ? { ...input }
      : {};
    const next = normalizeAdminConsoleSettings({
      ...previous,
      ...incoming
    });
    const changedKeys = ADMIN_CONSOLE_SETTINGS_KEYS.filter((key) => previous[key] !== next[key]);

    const actorPayload = this.normalizeActor(actor);
    const entity = currentEntity
      ? this.repo.merge(currentEntity, {
        payload: next,
        updatedBy: actorPayload
      })
      : this.repo.create({
        scope: SETTINGS_SCOPE_ADMIN_CONSOLE,
        payload: next,
        updatedBy: actorPayload
      });
    const saved = await this.repo.save(entity);
    this.clearCache();

    if (this.auditoria) {
      try {
        await this.auditoria.create({
          action: SETTINGS_AUDIT_ACTION,
          entity: SETTINGS_AUDIT_ENTITY,
          entityId: SETTINGS_SCOPE_ADMIN_CONSOLE,
          meta: {
            settings: next,
            changedKeys,
            mode: input?.mode || 'manual'
          },
          actor: actorPayload || undefined
        });
      } catch {
        // Nao interrompe persistencia de configuracoes por falha de auditoria.
      }
    }

    return this.toResponse(saved);
  }

  async resetAdminConsoleSettings(actor?: SettingsActor) {
    return this.upsertAdminConsoleSettings(
      {
        ...ADMIN_CONSOLE_DEFAULT_SETTINGS,
        mode: 'reset'
      },
      actor
    );
  }
}
