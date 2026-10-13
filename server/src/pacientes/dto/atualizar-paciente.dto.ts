import {
  IsArray,
  IsEmail,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min
} from 'class-validator';
import { Transform } from 'class-transformer';

const emptyToUndefined = ({ value }: { value: unknown }) => {
  if (value === null || value === undefined) return undefined;
  const normalized = String(value).trim();
  return normalized ? normalized : undefined;
};

const normalizeUuidArray = ({ value }: { value: unknown }) => {
  if (value === null || value === undefined || value === '') return undefined;
  if (!Array.isArray(value)) return value;
  const normalized = value
    .map((item) => String(item).trim())
    .filter((item) => item.length > 0);
  return normalized.length > 0 ? normalized : undefined;
};

const numberToValue = ({ value }: { value: unknown }) => {
  if (value === null || value === undefined || value === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
};

export class AtualizarPacienteDto {
  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsString()
  cpf?: string;

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
  status?: string;

  @IsOptional()
  @IsString()
  modalidadePrincipal?: string;

  @IsOptional()
  @IsString()
  tempoPratica?: string;

  @IsOptional()
  @Transform(numberToValue)
  @IsInt()
  @Min(1)
  @Max(14)
  frequenciaSemanal?: number;

  @IsOptional()
  @Transform(numberToValue)
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
  @IsString()
  observacoes?: string;

  @IsOptional()
  @IsString()
  historicoSaude?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  comorbidadesPessoais?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  comorbidadesFamiliares?: string[];

  @IsOptional()
  confirmacaoAtleta?: Record<string, unknown>;

  @IsOptional()
  anexos?: Array<Record<string, unknown>>;

  @IsOptional()
  @IsArray()
  mensagensProfessor?: Array<Record<string, unknown>>;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID()
  projetoId?: string;

  @IsOptional()
  @IsString()
  projetoNome?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID()
  alunoResponsavelId?: string;

  @IsOptional()
  @IsString()
  alunoResponsavelNome?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID()
  professorSupervisorId?: string;

  @IsOptional()
  @IsString()
  professorSupervisorNome?: string;

  @IsOptional()
  @Transform(normalizeUuidArray)
  @IsArray()
  @IsUUID(undefined, { each: true })
  equipeTecnicaIds?: string[];

  @IsOptional()
  @IsArray()
  @IsObject({ each: true })
  equipeProfissional?: Array<{ userId: string; userName: string; area: string; papel: string }>;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID()
  atletaUserId?: string;

  @IsOptional()
  @IsString()
  consentimentoPesquisa?: string;

  @IsOptional()
  @IsString()
  consentimentoData?: string;

  @IsOptional()
  @IsString()
  consentimentoVersao?: string;
}
