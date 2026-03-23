import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Auditoria } from './auditoria.entity';
import { CriarAuditoriaDto } from './dto/criar-auditoria.dto';

@Injectable()
export class AuditoriaService {
  constructor(@InjectRepository(Auditoria) private repo: Repository<Auditoria>) {}

  findAll(filters?: {
    action?: string;
    entity?: string;
    entityId?: string;
    limit?: number;
  }) {
    const hasFilters = Boolean(filters?.action || filters?.entity || filters?.entityId || Number.isFinite(filters?.limit));
    if (!hasFilters) {
      return this.repo.find({ order: { createdAt: 'DESC' } });
    }

    const qb = this.repo.createQueryBuilder('auditoria')
      .orderBy('auditoria.createdAt', 'DESC');

    if (filters?.action) {
      qb.andWhere('auditoria.action = :action', { action: filters.action });
    }
    if (filters?.entity) {
      qb.andWhere('auditoria.entity = :entity', { entity: filters.entity });
    }
    if (filters?.entityId) {
      qb.andWhere('auditoria.entityId = :entityId', { entityId: filters.entityId });
    }

    if (Number.isFinite(filters?.limit)) {
      const boundedLimit = Math.min(Math.max(Math.trunc(Number(filters?.limit)), 1), 200);
      qb.take(boundedLimit);
    }

    return qb.getMany();
  }

  findById(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  async create(dto: CriarAuditoriaDto & { actor?: Record<string, unknown> }) {
    const entry = this.repo.create(dto);
    return this.repo.save(entry);
  }

  async remove(id: string) {
    const entry = await this.findById(id);
    if (!entry) {
      throw new NotFoundException('Registro nao encontrado.');
    }
    await this.repo.delete(id);
    return { success: true };
  }
}
