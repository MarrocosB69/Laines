import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';

export class CriarNotificacaoDto {
  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsString()
  titulo!: string;

  @IsString()
  mensagem!: string;

  @IsOptional()
  @IsString()
  tipo?: string;

  @IsOptional()
  @IsString()
  targetRole?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetRoles?: string[];

  @IsOptional()
  @IsString()
  targetDiretoria?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetDiretorias?: string[];
}
