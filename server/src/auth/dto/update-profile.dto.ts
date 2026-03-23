import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MinLength
} from 'class-validator';

const emptyToUndefined = ({ value }: { value: unknown }) => {
  if (value === null || value === undefined) return undefined;
  const normalized = String(value).trim();
  return normalized ? normalized : undefined;
};

export class UpdateProfileDto {
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @Matches(/^(\d{3}\.?\d{3}\.?\d{3}-?\d{2})$/, {
    message: 'CPF invalido. Utilize 11 digitos.'
  })
  cpf?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsDateString()
  dataNascimento?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  matricula?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  periodo?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  curso?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  telefone?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID()
  supervisorId?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUUID()
  projetoId?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  departamento?: string;
}
