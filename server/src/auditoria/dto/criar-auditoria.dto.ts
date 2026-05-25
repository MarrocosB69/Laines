import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CriarAuditoriaDto {
  @IsString()
  @MaxLength(60)
  action!: string;

  @IsString()
  @MaxLength(60)
  entity!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  entityId?: string;

  @IsOptional()
  @IsObject()
  meta?: Record<string, unknown>;
}
