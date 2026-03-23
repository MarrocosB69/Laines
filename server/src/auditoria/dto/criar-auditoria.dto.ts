import { IsOptional, IsString } from 'class-validator';

export class CriarAuditoriaDto {
  @IsString()
  action!: string;

  @IsString()
  entity!: string;

  @IsOptional()
  @IsString()
  entityId?: string;

  @IsOptional()
  meta?: Record<string, unknown>;
}
