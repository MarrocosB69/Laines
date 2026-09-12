import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  IsUUID,
  IsArray,
  ArrayMaxSize
} from 'class-validator';
import { PERMISSIONS, USER_ROLES, USER_STATUS } from '../../common/domain/access.constants';

const VALID_PERMISSIONS = Object.values(PERMISSIONS);

const emptyToUndefined = ({ value }: { value: unknown }) => {
  if (value === null || value === undefined) return undefined;
  const normalized = String(value).trim();
  return normalized ? normalized : undefined;
};

export class CreateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsString()
  @IsIn([...USER_ROLES])
  role!: string;

  @IsOptional()
  @IsString()
  @Matches(/^(\d{3}\.?\d{3}\.?\d{3}-?\d{2})$/, {
    message: 'CPF invalido. Utilize 11 digitos.'
  })
  cpf?: string;

  @IsOptional()
  @IsString()
  dataNascimento?: string;

  @IsOptional()
  @IsString()
  matricula?: string;

  @IsOptional()
  @IsString()
  periodo?: string;

  @IsOptional()
  @IsUUID()
  supervisorId?: string;

  @IsOptional()
  @IsString()
  supervisorNome?: string;

  @IsOptional()
  @IsUUID()
  profissionalId?: string;

  @IsOptional()
  @IsString()
  diretoria?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @IsIn(VALID_PERMISSIONS, { each: true })
  permissions?: string[];

  @IsOptional()
  @IsString()
  curso?: string;

  @IsOptional()
  @IsUUID()
  projetoId?: string;

  @IsOptional()
  @IsString()
  projetoNome?: string;

  @IsOptional()
  @IsString()
  telefone?: string;

  @IsOptional()
  @IsString()
  crn?: string;

  @IsOptional()
  @IsString()
  conselhoTipo?: string;

  @IsOptional()
  @IsString()
  conselhoNumero?: string;

  @IsOptional()
  @IsString()
  departamento?: string;

  @IsOptional()
  @IsString()
  nivelAcesso?: string;

  @IsOptional()
  @IsBoolean()
  coordAtendimento?: boolean;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @IsIn([...USER_STATUS])
  status?: string;
}
