import { IsDateString, IsOptional, IsString } from 'class-validator';

export class AtualizarNotificacaoDto {
  @IsOptional()
  @IsString()
  titulo?: string;

  @IsOptional()
  @IsString()
  mensagem?: string;

  @IsOptional()
  @IsString()
  tipo?: string;

  @IsOptional()
  @IsDateString()
  readAt?: string;
}
