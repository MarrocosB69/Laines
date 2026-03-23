import { IsOptional, IsString, IsUUID } from 'class-validator';

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
}
