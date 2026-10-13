import { IsOptional, IsString, MaxLength } from 'class-validator';

// UPD-17: envio para revisao e opcional; a observacao tambem e (o aluno pode
// so pedir revisao sem perguntar nada). Sem MinLength aqui de proposito —
// difere de DevolverAvaliacaoDto, cuja observacao e obrigatoria (5-1000).
export class EnviarRevisaoAvaliacaoDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observacao?: string;
}
