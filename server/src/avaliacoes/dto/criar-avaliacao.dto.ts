import {
  IsArray,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID
} from 'class-validator';
import { AVALIACAO_REGISTRY_BY_TIPO } from '../evaluation-registry';

const AVALIACAO_STATUS = ['rascunho', 'finalizada'] as const;
const VALID_TIPOS = Object.keys(AVALIACAO_REGISTRY_BY_TIPO);

export class CriarAvaliacaoDto {
  @IsOptional()
  @IsUUID()
  sessaoId?: string;

  @IsString()
  @IsIn(VALID_TIPOS, { message: 'Tipo de avaliacao invalido.' })
  tipo!: string;

  @IsString()
  @IsUUID()
  pacienteId!: string;

  @IsOptional()
  @IsUUID()
  projetoId?: string;

  @IsOptional()
  @IsString()
  projetoNome?: string;

  @IsOptional()
  @IsUUID()
  alunoId?: string;

  @IsOptional()
  @IsString()
  @IsIn(AVALIACAO_STATUS)
  status?: string;

  @IsOptional()
  @IsDateString()
  data?: string;

  @IsOptional()
  dados?: Record<string, unknown>;

  @IsOptional()
  resultados?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  registros?: Array<Record<string, unknown>>;

  @IsOptional()
  meta?: Record<string, unknown>;

  @IsOptional()
  autoSave?: boolean;

  @IsOptional()
  @IsNumber()
  schemaVersion?: number;

  @IsOptional()
  @IsString()
  formulaId?: string;

  @IsOptional()
  @IsString()
  formulaVersion?: string;

  @IsOptional()
  @IsString()
  sourceSystem?: string;

  @IsOptional()
  @IsString()
  sourceRef?: string;

  @IsOptional()
  @IsDateString()
  measuredAt?: string;

  @IsOptional()
  @IsNumber()
  totalDiario?: number;

  @IsOptional()
  percentuais?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  classificacao?: string;

  @IsOptional()
  @IsString()
  classificacaoLabel?: string;

  @IsOptional()
  @IsNumber()
  pontuacaoEBIA?: number;
}
