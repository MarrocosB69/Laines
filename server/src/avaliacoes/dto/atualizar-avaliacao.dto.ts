import {
  IsArray,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID
} from 'class-validator';

const AVALIACAO_STATUS = ['rascunho', 'finalizada'] as const;

export class AtualizarAvaliacaoDto {
  @IsOptional()
  @IsString()
  tipo?: string;

  @IsOptional()
  @IsUUID()
  pacienteId?: string;

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
