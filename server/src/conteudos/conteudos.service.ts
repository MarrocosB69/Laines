import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conteudo } from './conteudo.entity';
import { CriarConteudoDto } from './dto/criar-conteudo.dto';
import { AtualizarConteudoDto } from './dto/atualizar-conteudo.dto';
import { RealtimeGateway } from '../realtime/realtime.gateway';

type FiltrosConteudo = {
  categoria?: string;
};

@Injectable()
export class ConteudosService {
  constructor(
    @InjectRepository(Conteudo) private repo: Repository<Conteudo>,
    private realtime: RealtimeGateway
  ) {}

  private normalizePayload<T extends { [key: string]: any }>(payload: T) {
    const normalizeText = (value?: string) => {
      if (value === undefined || value === null) return undefined;
      const trimmed = String(value).trim();
      return trimmed.length ? trimmed : undefined;
    };

    const cursos = Array.isArray(payload.cursos)
      ? payload.cursos.map((item) => String(item).trim()).filter(Boolean)
      : undefined;

    return {
      ...payload,
      data: normalizeText(payload.data),
      link: normalizeText(payload.link),
      descricao: normalizeText(payload.descricao),
      tipo: normalizeText(payload.tipo),
      publico: normalizeText(payload.publico),
      cursos: cursos && cursos.length ? cursos : undefined
    };
  }

  findAll(filtros: FiltrosConteudo) {
    const qb = this.repo.createQueryBuilder('conteudo')
      .orderBy('conteudo.createdAt', 'DESC');

    if (filtros.categoria) {
      qb.andWhere('conteudo.categoria = :categoria', { categoria: filtros.categoria });
    }

    return qb.getMany();
  }

  findById(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  async create(dto: CriarConteudoDto) {
    const payload = this.normalizePayload(dto);
    const conteudo = this.repo.create(payload);
    const saved = await this.repo.save(conteudo);
    this.realtime.emit('conteudos.created', saved);
    return saved;
  }

  async update(id: string, dto: AtualizarConteudoDto) {
    const conteudo = await this.findById(id);
    if (!conteudo) {
      throw new NotFoundException('Conteudo nao encontrado.');
    }
    const payload = this.normalizePayload(dto);
    const merged = this.repo.merge(conteudo, payload as any);
    const saved = await this.repo.save(merged);
    this.realtime.emit('conteudos.updated', saved);
    return saved;
  }

  async remove(id: string) {
    const conteudo = await this.findById(id);
    if (!conteudo) {
      throw new NotFoundException('Conteudo nao encontrado.');
    }
    await this.repo.delete(id);
    this.realtime.emit('conteudos.deleted', { id });
    return { success: true };
  }
}
