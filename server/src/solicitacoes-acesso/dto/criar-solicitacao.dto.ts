import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import {
  SOLICITACAO_AREAS,
  SOLICITACAO_CARGOS
} from '../../common/domain/access.constants';

const emptyToUndefined = ({ value }: { value: unknown }) => {
  if (value === null || value === undefined) return undefined;
  const normalized = String(value).trim();
  return normalized ? normalized : undefined;
};

export class CriarSolicitacaoDto {
  @IsString()
  @MaxLength(120)
  nome!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MaxLength(20)
  cpf!: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  dataNascimento?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(30)
  telefone?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @IsIn([...SOLICITACAO_AREAS])
  area?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @IsIn([...SOLICITACAO_CARGOS])
  cargoSolicitado?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  matricula?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  conselhoTipo?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  conselhoNumero?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  instituicao?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  diretoria?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID()
  projetoId?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  projetoNome?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(1000)
  justificativa?: string;
}
