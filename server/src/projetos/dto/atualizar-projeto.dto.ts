import { IsArray, IsOptional, IsString, IsUUID } from 'class-validator';

export class AtualizarProjetoDto {
  @IsOptional()
  @IsString()
  nome?: string;

  @IsOptional()
  @IsString()
  area?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  coordenador?: string;

  @IsOptional()
  @IsUUID()
  coordenadorId?: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  equipe?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  alunosIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  alunosNomes?: string[];
}
