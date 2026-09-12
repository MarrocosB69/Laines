import { IsArray, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export const CATEGORIAS_CONTEUDO = [
  'comunicados_pesquisa',
  'materiais_pesquisa',
  'reunioes_cientificas',
  'materiais_ensino',
  'capacitacoes',
  'materiais_extensao',
  'comunicados_marketing',
  'materiais_marketing'
] as const;

export const STATUS_CONTEUDO = [
  'rascunho',
  'em_andamento',
  'pendente_aprovacao',
  'aprovado',
  'publicado',
  'arquivado'
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
