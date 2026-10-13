import {
  BadRequestException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { TacoFood } from './taco.entity';

type DecimalKeys =
  | 'umidade'
  | 'energiaKcal'
  | 'energiaKj'
  | 'proteina'
  | 'lipidios'
  | 'colesterol'
  | 'carboidrato'
  | 'fibra'
  | 'cinzas'
  | 'calcio'
  | 'magnesio'
  | 'manganes'
  | 'fosforo'
  | 'ferro'
  | 'sodio'
  | 'potassio'
  | 'cobre'
  | 'zinco'
  | 'retinol'
  | 'tiamina'
  | 'riboflavina'
  | 'piridoxina'
  | 'niacina'
  | 'vitaminaC'
  | 'vitaminaD'
  | 'vitaminaE';

export type TacoItem = {
  id: number;
  codigo: number;
  codigoTexto: string | null;
  fonte: string;
  tipoAlimento: string | null;
  descricao: string;
  grupo: string;
  umidade: number | null;
  energiaKcal: number | null;
  energiaKj: number | null;
  proteina: number | null;
  lipidios: number | null;
  colesterol: number | null;
  carboidrato: number | null;
  fibra: number | null;
  cinzas: number | null;
  calcio: number | null;
  magnesio: number | null;
  manganes: number | null;
  fosforo: number | null;
  ferro: number | null;
  sodio: number | null;
  potassio: number | null;
  cobre: number | null;
  zinco: number | null;
  retinol: number | null;
  tiamina: number | null;
  riboflavina: number | null;
  piridoxina: number | null;
  niacina: number | null;
  vitaminaC: number | null;
  vitaminaD: number | null;
  vitaminaE: number | null;
};

export type TacoCalculoItem = {
  alimentoId: number;
  quantidadeGramas: number;
};

export type NutrientesCalculados = {
  energiaKcal: number;
  energiaKj: number;
  proteina: number;
  lipidios: number;
  colesterol: number;
  carboidrato: number;
  fibra: number;
  cinzas: number;
  calcio: number;
  magnesio: number;
  manganes: number;
  fosforo: number;
  ferro: number;
  sodio: number;
  potassio: number;
  cobre: number;
  zinco: number;
  retinol: number;
  tiamina: number;
  riboflavina: number;
  piridoxina: number;
  niacina: number;
  vitaminaC: number;
  vitaminaD: number;
  vitaminaE: number;
  vitaminaB12: number | null;
  totalAlimentos: number;
  totalGramas: number;
};

export type UpsertTacoPayload = {
  codigo: number;
  descricao: string;
  grupo: string;
  umidade?: number | null;
  energiaKcal?: number | null;
  energiaKj?: number | null;
  proteina?: number | null;
  lipidios?: number | null;
  colesterol?: number | null;
  carboidrato?: number | null;
  fibra?: number | null;
  cinzas?: number | null;
  calcio?: number | null;
  magnesio?: number | null;
  manganes?: number | null;
  fosforo?: number | null;
  ferro?: number | null;
  sodio?: number | null;
  potassio?: number | null;
  cobre?: number | null;
  zinco?: number | null;
  retinol?: number | null;
  tiamina?: number | null;
  riboflavina?: number | null;
  piridoxina?: number | null;
  niacina?: number | null;
  vitaminaC?: number | null;
  vitaminaD?: number | null;
  vitaminaE?: number | null;
};

type BuscaParams = {
  query?: string;
  grupo?: string;
  limite?: number;
};

/** Termos de consulta, sem alterar a descricao oficial armazenada. */
export function termosBuscaAlimento(value: unknown): string[] {
  const normalizado = String(value ?? '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/\bc\/(?=\s|$)/g, 'com ')
    .replace(/\bs\/(?=\s|$)/g, 'sem ');
  const termos = [...new Set(normalizado.match(/[a-z0-9]+/g) || [])];
  return termos.length <= 12 ? termos : [];
}

const DECIMAL_FIELDS: DecimalKeys[] = [
  'umidade',
  'energiaKcal',
  'energiaKj',
  'proteina',
  'lipidios',
  'colesterol',
  'carboidrato',
  'fibra',
  'cinzas',
  'calcio',
  'magnesio',
  'manganes',
  'fosforo',
  'ferro',
  'sodio',
  'potassio',
  'cobre',
  'zinco',
  'retinol',
  'tiamina',
  'riboflavina',
  'piridoxina',
  'niacina',
  'vitaminaC',
  'vitaminaD',
  'vitaminaE'
];

const round = (value: number, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

@Injectable()
export class TacoService {
  constructor(
    @InjectRepository(TacoFood)
    private readonly repo: Repository<TacoFood>
  ) {}

  private toText(value: unknown): string {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  private toNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const parsed = Number(String(value).replace(',', '.').trim());
    return Number.isFinite(parsed) ? parsed : null;
  }

  private toLimit(value: unknown, fallback = 20): number {
    const parsed = this.toNumber(value);
    if (!Number.isFinite(parsed)) return fallback;
    const safe = Math.floor(parsed as number);
    if (safe <= 0) return fallback;
    return Math.min(safe, 100);
  }

  private toPublic(row: TacoFood): TacoItem {
    const payload: TacoItem = {
      id: row.id,
      codigo: row.codigo,
      codigoTexto: row.codigoTexto ?? null,
      fonte: row.fonte || 'TACO',
      tipoAlimento: row.tipoAlimento ?? null,
      descricao: row.descricao,
      grupo: row.grupo,
      umidade: null,
      energiaKcal: null,
      energiaKj: null,
      proteina: null,
      lipidios: null,
      colesterol: null,
      carboidrato: null,
      fibra: null,
      cinzas: null,
      calcio: null,
      magnesio: null,
      manganes: null,
      fosforo: null,
      ferro: null,
      sodio: null,
      potassio: null,
      cobre: null,
      zinco: null,
      retinol: null,
      tiamina: null,
      riboflavina: null,
      piridoxina: null,
      niacina: null,
      vitaminaC: null,
      vitaminaD: null,
      vitaminaE: null
    };

    DECIMAL_FIELDS.forEach((key) => {
      payload[key] = this.toNumber(row[key]);
    });

    return payload;
  }

  private toDecimalString(value: unknown): string | null {
    const parsed = this.toNumber(value);
    if (!Number.isFinite(parsed)) return null;
    return round(parsed as number, 2).toString();
  }

  private normalizeNutrientesOutput(value: Record<DecimalKeys, number>): NutrientesCalculados {
    return {
      energiaKcal: round(value.energiaKcal, 2),
      energiaKj: round(value.energiaKj, 2),
      proteina: round(value.proteina, 2),
      lipidios: round(value.lipidios, 2),
      colesterol: round(value.colesterol, 2),
      carboidrato: round(value.carboidrato, 2),
      fibra: round(value.fibra, 2),
      cinzas: round(value.cinzas, 2),
      calcio: round(value.calcio, 2),
      magnesio: round(value.magnesio, 2),
      manganes: round(value.manganes, 2),
      fosforo: round(value.fosforo, 2),
      ferro: round(value.ferro, 2),
      sodio: round(value.sodio, 2),
      potassio: round(value.potassio, 2),
      cobre: round(value.cobre, 2),
      zinco: round(value.zinco, 2),
      retinol: round(value.retinol, 2),
      tiamina: round(value.tiamina, 2),
      riboflavina: round(value.riboflavina, 2),
      piridoxina: round(value.piridoxina, 2),
      niacina: round(value.niacina, 2),
      vitaminaC: round(value.vitaminaC, 2),
      vitaminaD: round(value.vitaminaD, 2),
      vitaminaE: round(value.vitaminaE, 2),
      vitaminaB12: null,
      totalAlimentos: 0,
      totalGramas: 0
    };
  }

  async buscar(params: BuscaParams): Promise<TacoItem[]> {
    const query = this.toText(params?.query);
    const grupo = this.toText(params?.grupo);
    const limite = this.toLimit(params?.limite);
    const termos = termosBuscaAlimento(query);
    if (query && termos.length === 0) return [];
    const qb = this.repo.createQueryBuilder('alimento');
    if (query) {
      const codigo = termos.length === 1 && /^[a-z][0-9]+[a-z]$/.test(termos[0]);
      if (codigo) qb.andWhere('lower(alimento.codigoTexto) = :codigo', { codigo: termos[0] });
      else termos.forEach((termo, indice) => {
        const campo = 'imutavel_unaccent(lower(alimento.descricao))';
        const alternativa = termo === 'com' ? 'c/' : termo === 'sem' ? 's/' : null;
        qb.andWhere(
          alternativa
            ? `(${campo} LIKE :termo${indice} OR ${campo} LIKE :alternativa${indice})`
            : `${campo} LIKE :termo${indice}`,
          { [`termo${indice}`]: `%${termo}%`, ...(alternativa ? { [`alternativa${indice}`]: `%${alternativa}%` } : {}) }
        );
      });
    }
    if (grupo) {
      qb.andWhere(
        'imutavel_unaccent(lower(alimento.grupo)) LIKE imutavel_unaccent(lower(:grupo))',
        { grupo: `%${grupo}%` }
      );
    }

    if (query) qb.orderBy('length(alimento.descricao)', 'ASC').addOrderBy('alimento.descricao', 'ASC');
    else qb.orderBy('alimento.descricao', 'ASC');
    const rows = await qb.take(limite).getMany();

    return rows.map((item) => this.toPublic(item));
  }

  async buscarPorId(id: number): Promise<TacoItem> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException('Alimento TACO nao encontrado.');
    }
    return this.toPublic(row);
  }

  async create(payload: UpsertTacoPayload): Promise<TacoItem> {
    const codigo = this.toNumber(payload?.codigo);
    const descricao = this.toText(payload?.descricao);
    const grupo = this.toText(payload?.grupo);

    if (!Number.isInteger(codigo)) {
      throw new BadRequestException('codigo deve ser inteiro.');
    }
    if (!descricao) {
      throw new BadRequestException('descricao e obrigatoria.');
    }
    if (!grupo) {
      throw new BadRequestException('grupo e obrigatorio.');
    }

    const entity = this.repo.create({
      codigo: Number(codigo),
      descricao,
      grupo,
      umidade: this.toDecimalString(payload?.umidade),
      energiaKcal: this.toDecimalString(payload?.energiaKcal),
      energiaKj: this.toDecimalString(payload?.energiaKj),
      proteina: this.toDecimalString(payload?.proteina),
      lipidios: this.toDecimalString(payload?.lipidios),
      colesterol: this.toDecimalString(payload?.colesterol),
      carboidrato: this.toDecimalString(payload?.carboidrato),
      fibra: this.toDecimalString(payload?.fibra),
      cinzas: this.toDecimalString(payload?.cinzas),
      calcio: this.toDecimalString(payload?.calcio),
      magnesio: this.toDecimalString(payload?.magnesio),
      manganes: this.toDecimalString(payload?.manganes),
      fosforo: this.toDecimalString(payload?.fosforo),
      ferro: this.toDecimalString(payload?.ferro),
      sodio: this.toDecimalString(payload?.sodio),
      potassio: this.toDecimalString(payload?.potassio),
      cobre: this.toDecimalString(payload?.cobre),
      zinco: this.toDecimalString(payload?.zinco),
      retinol: this.toDecimalString(payload?.retinol),
      tiamina: this.toDecimalString(payload?.tiamina),
      riboflavina: this.toDecimalString(payload?.riboflavina),
      piridoxina: this.toDecimalString(payload?.piridoxina),
      niacina: this.toDecimalString(payload?.niacina),
      vitaminaC: this.toDecimalString(payload?.vitaminaC),
      vitaminaD: this.toDecimalString(payload?.vitaminaD),
      vitaminaE: this.toDecimalString(payload?.vitaminaE)
    });

    const saved = await this.repo.save(entity);
    return this.toPublic(saved);
  }

  async update(id: number, payload: Partial<UpsertTacoPayload>): Promise<TacoItem> {
    const current = await this.repo.findOne({ where: { id } });
    if (!current) {
      throw new NotFoundException('Alimento TACO nao encontrado.');
    }

    const merged = this.repo.merge(current, {
      ...(payload.codigo !== undefined ? { codigo: Number(payload.codigo) } : {}),
      ...(payload.descricao !== undefined ? { descricao: this.toText(payload.descricao) } : {}),
      ...(payload.grupo !== undefined ? { grupo: this.toText(payload.grupo) } : {}),
      ...(payload.umidade !== undefined ? { umidade: this.toDecimalString(payload.umidade) } : {}),
      ...(payload.energiaKcal !== undefined ? { energiaKcal: this.toDecimalString(payload.energiaKcal) } : {}),
      ...(payload.energiaKj !== undefined ? { energiaKj: this.toDecimalString(payload.energiaKj) } : {}),
      ...(payload.proteina !== undefined ? { proteina: this.toDecimalString(payload.proteina) } : {}),
      ...(payload.lipidios !== undefined ? { lipidios: this.toDecimalString(payload.lipidios) } : {}),
      ...(payload.colesterol !== undefined ? { colesterol: this.toDecimalString(payload.colesterol) } : {}),
      ...(payload.carboidrato !== undefined ? { carboidrato: this.toDecimalString(payload.carboidrato) } : {}),
      ...(payload.fibra !== undefined ? { fibra: this.toDecimalString(payload.fibra) } : {}),
      ...(payload.cinzas !== undefined ? { cinzas: this.toDecimalString(payload.cinzas) } : {}),
      ...(payload.calcio !== undefined ? { calcio: this.toDecimalString(payload.calcio) } : {}),
      ...(payload.magnesio !== undefined ? { magnesio: this.toDecimalString(payload.magnesio) } : {}),
      ...(payload.manganes !== undefined ? { manganes: this.toDecimalString(payload.manganes) } : {}),
      ...(payload.fosforo !== undefined ? { fosforo: this.toDecimalString(payload.fosforo) } : {}),
      ...(payload.ferro !== undefined ? { ferro: this.toDecimalString(payload.ferro) } : {}),
      ...(payload.sodio !== undefined ? { sodio: this.toDecimalString(payload.sodio) } : {}),
      ...(payload.potassio !== undefined ? { potassio: this.toDecimalString(payload.potassio) } : {}),
      ...(payload.cobre !== undefined ? { cobre: this.toDecimalString(payload.cobre) } : {}),
      ...(payload.zinco !== undefined ? { zinco: this.toDecimalString(payload.zinco) } : {}),
      ...(payload.retinol !== undefined ? { retinol: this.toDecimalString(payload.retinol) } : {}),
      ...(payload.tiamina !== undefined ? { tiamina: this.toDecimalString(payload.tiamina) } : {}),
      ...(payload.riboflavina !== undefined ? { riboflavina: this.toDecimalString(payload.riboflavina) } : {}),
      ...(payload.piridoxina !== undefined ? { piridoxina: this.toDecimalString(payload.piridoxina) } : {}),
      ...(payload.niacina !== undefined ? { niacina: this.toDecimalString(payload.niacina) } : {}),
      ...(payload.vitaminaC !== undefined ? { vitaminaC: this.toDecimalString(payload.vitaminaC) } : {}),
      ...(payload.vitaminaD !== undefined ? { vitaminaD: this.toDecimalString(payload.vitaminaD) } : {}),
      ...(payload.vitaminaE !== undefined ? { vitaminaE: this.toDecimalString(payload.vitaminaE) } : {})
    });

    if (!Number.isInteger(merged.codigo)) {
      throw new BadRequestException('codigo deve ser inteiro.');
    }
    if (!merged.descricao) {
      throw new BadRequestException('descricao e obrigatoria.');
    }
    if (!merged.grupo) {
      throw new BadRequestException('grupo e obrigatorio.');
    }

    const saved = await this.repo.save(merged);
    return this.toPublic(saved);
  }

  async remove(id: number): Promise<{ deleted: true }> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException('Alimento TACO nao encontrado.');
    }
    await this.repo.remove(row);
    return { deleted: true };
  }

  async calcularNutrientes(items: TacoCalculoItem[]): Promise<NutrientesCalculados> {
    if (!Array.isArray(items) || items.length === 0) {
      throw new BadRequestException('Informe ao menos um alimento para calcular nutrientes.');
    }

    const normalizedItems = items
      .map((item) => ({
        alimentoId: Number(item?.alimentoId),
        quantidadeGramas: Number(item?.quantidadeGramas)
      }))
      .filter((item) => Number.isInteger(item.alimentoId) && Number.isFinite(item.quantidadeGramas) && item.quantidadeGramas > 0);

    if (!normalizedItems.length) {
      throw new BadRequestException('Itens enviados para calculo estao invalidos.');
    }

    const ids = Array.from(new Set(normalizedItems.map((item) => item.alimentoId)));
    const foods = await this.repo.find({
      where: { id: In(ids) }
    });

    if (foods.length !== ids.length) {
      const found = new Set(foods.map((item) => item.id));
      const missing = ids.filter((id) => !found.has(id));
      throw new NotFoundException(`Alimentos nao encontrados: ${missing.join(', ')}`);
    }

    const byId = new Map(foods.map((food) => [food.id, food]));
    const totals = DECIMAL_FIELDS.reduce<Record<DecimalKeys, number>>((acc, key) => {
      acc[key] = 0;
      return acc;
    }, {} as Record<DecimalKeys, number>);

    let totalGramas = 0;
    normalizedItems.forEach((item) => {
      const food = byId.get(item.alimentoId);
      if (!food) return;
      const fator = item.quantidadeGramas / 100;
      totalGramas += item.quantidadeGramas;

      DECIMAL_FIELDS.forEach((field) => {
        const value = this.toNumber(food[field]);
        if (!Number.isFinite(value)) return;
        totals[field] += (value as number) * fator;
      });
    });

    const output = this.normalizeNutrientesOutput(totals);
    return {
      ...output,
      totalAlimentos: normalizedItems.length,
      totalGramas: round(totalGramas, 2)
    };
  }
}
