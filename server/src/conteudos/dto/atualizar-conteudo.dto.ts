import { IsArray, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { CATEGORIAS_CONTEUDO, STATUS_CONTEUDO } from './criar-conteudo.dto';

export class AtualizarConteudoDto {
  @IsOptional()
  @IsString()
  @IsIn(CATEGORIAS_CONTEUDO)
  categoria?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  titulo?: string;

  @IsOptional()
  @IsString()
  @IsIn(STATUS_CONTEUDO)
  status?: string;

  @IsOptional()
  @IsString()
  data?: string;

  @IsOptional()
  @IsString()
  link?: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsString()
  tipo?: string;

  @IsOptional()
  @IsString()
  publico?: string;

  @IsOptional()
  @IsArray()
  cursos?: string[];

  @IsOptional()
  @IsArray()
  autores?: string[];

  @IsOptional()
  @IsString()
  profissionalNome?: string;

  @IsOptional()
  @IsString()
  profissionalCredencial?: string;

  @IsOptional()
  @IsArray()
  equipeOrganizacao?: string[];
}
