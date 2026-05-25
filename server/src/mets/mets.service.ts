import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { Met, MetsCategoria, MetsIntensidade } from './mets.entity';

export type ListMetsQuery = {
  modalidade?: string;
  categoria?: MetsCategoria | string;
};

export type UpsertMetPayload = {
  modalidade: string;
  categoria: MetsCategoria;
  intensidade: MetsIntensidade;
  metValue: number;
  fonte?: string;
  codigoAinsworth?: string | null;
};

export type CalculateMetPayload = {
  metValue: number;
  pesoKg: number;
  duracaoHoras: number;
  nivelCompetitivo: string;
};

type PublicMet = Omit<Met, 'metValue'> & { metValue: number };

const NIVEIS_EFICIENCIA: Record<string, number> = {
  amador: 1.0,
  'semi-pro': 0.95,
  semipro: 0.95,
  elite: 0.88
};

@Injectable()
export class MetsService {
  constructor(
    @InjectRepository(Met)
    private readonly repo: Repository<Met>
  ) {}

  private toNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const parsed = Number(String(value).replace(',', '.').trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  private toText(value: unknown): string {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  private normalizeNivelCompetitivo(value: string): string {
    return this.toText(value).toLowerCase();
  }

  private toPublic(entity: Met): PublicMet {
    return {
      ...entity,
      metValue: this.toNumber(entity.metValue) ?? 0
    };
  }

  async list(query: ListMetsQuery): Promise<PublicMet[]> {
    const modalidade = this.toText(query?.modalidade);
    const categoria = this.toText(query?.categoria);
    const where = {
      ...(modalidade ? { modalidade: ILike(`%${modalidade}%`) } : {}),
      ...(categoria ? { categoria: categoria as MetsCategoria } : {})
    };

    const rows = await this.repo.find({
      where,
      order: {
        modalidade: 'ASC',
        categoria: 'ASC',
        intensidade: 'ASC'
      }
    });
    return rows.map((item) => this.toPublic(item));
  }

  async findOne(id: string): Promise<PublicMet> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Registro de MET nao encontrado.');
    return this.toPublic(row);
  }

  async create(payload: UpsertMetPayload): Promise<PublicMet> {
    const modalidade = this.toText(payload?.modalidade);
    const metValue = this.toNumber(payload?.metValue);
    if (!modalidade) throw new BadRequestException('Modalidade e obrigatoria.');
    if (!Number.isFinite(metValue) || (metValue as number) <= 0) {
      throw new BadRequestException('metValue deve ser maior que zero.');
    }

    const entity = this.repo.create({
      modalidade,
      categoria: payload.categoria,
      intensidade: payload.intensidade,
      metValue: Number((metValue as number).toFixed(1)).toString(),
      fonte: this.toText(payload?.fonte) || 'Ainsworth 2011',
      codigoAinsworth: this.toText(payload?.codigoAinsworth) || null
    });
    const saved = await this.repo.save(entity);
    return this.toPublic(saved);
  }

  async update(id: string, payload: Partial<UpsertMetPayload>): Promise<PublicMet> {
    const current = await this.repo.findOne({ where: { id } });
    if (!current) throw new NotFoundException('Registro de MET nao encontrado.');

    const next = this.repo.merge(current, {
      ...(payload.modalidade !== undefined ? { modalidade: this.toText(payload.modalidade) } : {}),
      ...(payload.categoria !== undefined ? { categoria: payload.categoria } : {}),
      ...(payload.intensidade !== undefined ? { intensidade: payload.intensidade } : {}),
      ...(payload.metValue !== undefined ? { metValue: Number((payload.metValue || 0).toFixed(1)).toString() } : {}),
      ...(payload.fonte !== undefined ? { fonte: this.toText(payload.fonte) || 'Ainsworth 2011' } : {}),
      ...(payload.codigoAinsworth !== undefined ? { codigoAinsworth: this.toText(payload.codigoAinsworth) || null } : {})
    });

    const parsedMet = this.toNumber(next.metValue);
    if (!next.modalidade) throw new BadRequestException('Modalidade e obrigatoria.');
    if (!Number.isFinite(parsedMet) || (parsedMet as number) <= 0) {
      throw new BadRequestException('metValue deve ser maior que zero.');
    }

    const saved = await this.repo.save(next);
    return this.toPublic(saved);
  }

  async remove(id: string): Promise<{ deleted: true }> {
    const current = await this.repo.findOne({ where: { id } });
    if (!current) throw new NotFoundException('Registro de MET nao encontrado.');
    await this.repo.remove(current);
    return { deleted: true };
  }

  calcularGastoSessao(
    metValue: number,
    pesoKg: number,
    duracaoHoras: number,
    nivelCompetitivo: string
  ): number {
    const fatorEficiencia = NIVEIS_EFICIENCIA[this.normalizeNivelCompetitivo(nivelCompetitivo)] ?? 1.0;
    const gasto = metValue * pesoKg * duracaoHoras * fatorEficiencia;
    return Number(gasto.toFixed(2));
  }

  calcular(payload: CalculateMetPayload) {
    const metValue = this.toNumber(payload?.metValue);
    const pesoKg = this.toNumber(payload?.pesoKg);
    const duracaoHoras = this.toNumber(payload?.duracaoHoras);
    const nivelCompetitivo = this.toText(payload?.nivelCompetitivo) || 'amador';

    if (!Number.isFinite(metValue) || (metValue as number) <= 0) {
      throw new BadRequestException('metValue deve ser maior que zero.');
    }
    if (!Number.isFinite(pesoKg) || (pesoKg as number) <= 0) {
      throw new BadRequestException('pesoKg deve ser maior que zero.');
    }
    if (!Number.isFinite(duracaoHoras) || (duracaoHoras as number) <= 0) {
      throw new BadRequestException('duracaoHoras deve ser maior que zero.');
    }

    const fatorEficiencia = NIVEIS_EFICIENCIA[this.normalizeNivelCompetitivo(nivelCompetitivo)] ?? 1.0;
    const gastoKcal = this.calcularGastoSessao(
      metValue as number,
      pesoKg as number,
      duracaoHoras as number,
      nivelCompetitivo
    );

    return {
      gastoKcal,
      fatorEficiencia,
      metValue: Number((metValue as number).toFixed(1)),
      pesoKg: Number((pesoKg as number).toFixed(2)),
      duracaoHoras: Number((duracaoHoras as number).toFixed(2)),
      nivelCompetitivo
    };
  }
}
