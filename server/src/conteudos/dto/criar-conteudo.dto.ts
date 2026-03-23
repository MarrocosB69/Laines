import { IsArray, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export const CATEGORIAS_CONTEUDO = [
  'reunioes_cientificas',
  'materiais_ensino',
  'capacitacoes',
  'materiais_extensao'
] as const;

export class CriarConteudoDto {
  @IsString()
  @IsIn(CATEGORIAS_CONTEUDO)
  categoria!: string;

  @IsString()
  @MinLength(2)
  titulo!: string;

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
