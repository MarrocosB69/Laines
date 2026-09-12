import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength
} from 'class-validator';
import { Transform } from 'class-transformer';

const toNumber = ({ value }: { value: unknown }) => {
  if (value === '' || value == null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : value;
};

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
  @IsObject()
  relatoNegativo?: Record<string, unknown>;

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
