import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested
} from 'class-validator';

const numberToValue = ({ value }: { value: unknown }) => {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
};

class OnboardingCargaSemanalDto {
  @IsOptional()
  @Transform(numberToValue)
  @IsNumber()
  @Min(0)
  tecnico?: number;

  @IsOptional()
  @Transform(numberToValue)
  @IsNumber()
  @Min(0)
  tatico?: number;

  @IsOptional()
  @Transform(numberToValue)
  @IsNumber()
  @Min(0)
  fisico?: number;

  @IsOptional()
  @Transform(numberToValue)
  @IsNumber()
  @Min(0)
  preventivo?: number;
}

class OnboardingLesaoDto {
  @IsOptional()
  @IsString()
  local?: string;

  @IsOptional()
  @IsString()
  tempoAfastado?: string;
}

class OnboardingCompeticaoDto {
  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsString()
  data?: string;
}

export class OnboardingEsportivoDto {
  @IsOptional()
  @IsString()
  modalidade?: string;

  @IsOptional()
  @IsString()
  posicao?: string;

  @IsOptional()
  @IsString()
  nivel?: string;

  @IsOptional()
  @IsString()
  clube?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  provas?: string[];

  @IsOptional()
  @Transform(numberToValue)
  @IsNumber()
  @Min(0)
  frequenciaSemanal?: number;

  @IsOptional()
  @Transform(numberToValue)
  @IsNumber()
  @Min(0)
  duracaoSessao?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => OnboardingCargaSemanalDto)
  cargaSemanal?: OnboardingCargaSemanalDto;

  @IsOptional()
  @IsString()
  fasePeriodizacao?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OnboardingLesaoDto)
  historicoLesoes?: OnboardingLesaoDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OnboardingCompeticaoDto)
  proximasCompeticoes?: OnboardingCompeticaoDto[];

  @IsOptional()
  @IsBoolean()
  historicaREDS?: boolean;
}

export class OnboardingMedicamentoDto {
  @IsString()
  nome!: string;

  @IsOptional()
  @IsString()
  dose?: string;

  @IsOptional()
  @IsString()
  frequencia?: string;
}

export class OnboardingSuplementoDto {
  @IsString()
  nome!: string;

  @IsOptional()
  @IsString()
  dose?: string;

  @IsOptional()
  @IsString()
  frequencia?: string;
}

export class AtualizarOnboardingAtletaDto {
  @IsOptional()
  @IsString()
  dataNascimento?: string;

  @IsOptional()
  @IsString()
  genero?: string;

  @IsOptional()
  @IsString()
  sexoBiologico?: string;

  @IsOptional()
  @IsString()
  identidadeGenero?: string;

  @IsOptional()
  @IsString()
  telefone?: string;

  @IsOptional()
  @IsString()
  cidade?: string;

  @IsOptional()
  @IsString()
  estado?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  objetivos?: string[];

  @IsOptional()
  @IsString()
  queixaPrincipal?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  patologias?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OnboardingMedicamentoDto)
  medicamentos?: OnboardingMedicamentoDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OnboardingSuplementoDto)
  suplementos?: OnboardingSuplementoDto[];

  @IsOptional()
  @IsString()
  alergias?: string;

  @IsOptional()
  @IsString()
  cirurgias?: string;

  @IsOptional()
  @Transform(numberToValue)
  @IsNumber()
  @Min(0)
  @Max(24)
  sonoHoras?: number;

  @IsOptional()
  @Transform(numberToValue)
  @IsNumber()
  @Min(1)
  @Max(5)
  sonoQualidade?: number;

  @IsOptional()
  @Transform(numberToValue)
  @IsNumber()
  @Min(1)
  @Max(10)
  estresseNivel?: number;

  @IsOptional()
  @IsString()
  alcoolUso?: string;

  @IsOptional()
  @IsString()
  tabacoUso?: string;

  @IsOptional()
  @IsString()
  cicloMenstrualRegularidade?: string;

  @IsOptional()
  @IsString()
  cicloMenstrualContraceptivo?: string;

  // Estruturado por parentesco: { pai: string[], mae: string[] }.
  // Aceita o formato legado string[] para nao quebrar rascunhos salvos.
  @IsOptional()
  @IsObject()
  comorbidadesFamiliares?: Record<string, unknown> | string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => OnboardingEsportivoDto)
  esportivo?: OnboardingEsportivoDto;

  @IsOptional()
  @IsObject()
  confirmacaoAtleta?: Record<string, unknown>;
}
