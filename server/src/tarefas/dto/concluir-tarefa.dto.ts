import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ConcluirTarefaDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  completionNote?: string;
}
