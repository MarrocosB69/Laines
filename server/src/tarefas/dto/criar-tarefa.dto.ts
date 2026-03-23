import { IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CriarTarefaDto {
  @IsString()
  @MinLength(2)
  title!: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  assignedRole?: string;

  @IsOptional()
  @IsUUID()
  createdBy?: string;

  @IsOptional()
  @IsString()
  createdByName?: string;
}
