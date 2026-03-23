import { IsArray, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { CATEGORIAS_CONTEUDO } from './criar-conteudo.dto';

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
}
