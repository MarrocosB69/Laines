import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ArrayMaxSize,
  ArrayMinSize,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

const toNumber = ({ value }: { value: unknown }) => {
  if (value === '' || value == null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : value;
};

const TEMPOS_PRATICA = [
  'Menos de 6 meses', '6 meses a 1 ano', '1 a 2 anos',
  '2 a 5 anos', 'Mais de 5 anos'
] as const;

export class EsporteInscricaoDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  modalidade!: string;

  @IsIn(TEMPOS_PRATICA)
  tempoPratica!: string;

  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(480)
  duracaoSessao!: number;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(14)
  frequenciaSemanal?: number;
}

export class RelatoNegativoInscricaoDto {
  @IsOptional()
  @IsBoolean()
  comorbidades?: boolean;

  @IsOptional()
  @IsBoolean()
  sinais?: boolean;

  @IsOptional()
  @IsBoolean()
  exames?: boolean;
}

export class InscricaoPublicaDto {
  @IsString()
  @MinLength(3)
  nome!: string;

  @IsString()
  cpf!: string;

  @IsBoolean()
  consentimentoAceito!: boolean;

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
  telefone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  profissao?: string;

  @IsOptional()
  @IsString()
  rendaMensal?: string;

  @IsOptional()
  @IsString()
  escolaridade?: string;

  @IsOptional()
  @IsString()
  endereco?: string;

  @IsOptional()
  @IsString()
  bairro?: string;

  @IsOptional()
  @IsString()
  cidade?: string;

  @IsOptional()
  @IsString()
  estado?: string;

  @IsOptional()
  @IsString()
  nomeResponsavel?: string;

  @IsOptional()
  @IsString()
  cpfResponsavel?: string;

  @IsOptional()
  @IsString()
  modalidadePrincipal?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => EsporteInscricaoDto)
  esportes?: EsporteInscricaoDto[];

  @IsOptional()
  @IsString()
  tempoPratica?: string;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(14)
  frequenciaSemanal?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(480)
  duracaoSessao?: number;

  @IsOptional()
  @IsString()
  outrasModalidades?: string;

  @IsOptional()
  @IsString()
  tipoTreino?: string;

  @IsOptional()
  @IsString()
  intensidade?: string;

  @IsOptional()
  @IsString()
  objetivo?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  comorbidadesPessoais?: string[];

  // Estruturado por parentesco: { pai: string[], mae: string[] }.
  // Registros antigos gravaram string[] — normalizado na leitura.
  @IsOptional()
  @IsObject()
  comorbidadesFamiliares?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sinaisClinicos?: string[];

  @IsOptional()
  @IsBoolean()
  lesaoAtual?: boolean;

  @IsOptional()
  @IsBoolean()
  lesaoUltimos3Meses?: boolean;

  @IsOptional()
  @IsIn(['normal', 'adaptada', 'interrompida'])
  impactoLesao?: 'normal' | 'adaptada' | 'interrompida';

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => RelatoNegativoInscricaoDto)
  relatoNegativo?: RelatoNegativoInscricaoDto;

  @IsOptional()
  @IsString()
  historicoSaude?: string;

  @IsOptional()
  @IsString()
  observacoes?: string;

  @IsOptional()
  @Transform(toNumber)
  @IsNumber()
  @Min(0)
  @Max(20)
  hidratacao?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(7)
  bristol?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(8)
  urinaPrimeira?: number;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(1)
  @Max(8)
  urinaUltima?: number;

  @IsOptional()
  @IsString()
  suplementoNoDia?: string;

  @IsOptional()
  @IsString()
  redsInstrumento?: string;

  @IsOptional()
  @IsObject()
  redsRespostas?: Record<string, unknown>;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  @Min(0)
  @Max(20)
  redsScore?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  examesRealizados?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  avaliacaoSolicitada?: string[];

  @IsOptional()
  @IsObject()
  ebia?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  comoSoube?: string;
}
