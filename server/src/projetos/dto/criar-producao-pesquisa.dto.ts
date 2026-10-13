import { IsArray, IsInt, IsOptional, IsString, IsUUID, IsUrl, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';

const toArray = (value: unknown) => {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return trimmed.split(',').map((item) => item.trim()).filter(Boolean);
    }
  }
  return [];
};

export class CriarProducaoPesquisaDto {
  @IsOptional()
  @IsUUID()
  projetoId?: string;

  @IsString()
  titulo!: string;

  @IsOptional()
  @IsString()
  tipo?: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(({ value }) => toArray(value))
  autores?: string[];

  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2200)
  @Transform(({ value }) => (value === '' || value == null ? undefined : Number(value)))
  ano?: number;

  @IsOptional()
  @IsString()
  area?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  visibilidade?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true }, { message: 'linkExterno deve ser uma URL completa.' })
  linkExterno?: string;
}
