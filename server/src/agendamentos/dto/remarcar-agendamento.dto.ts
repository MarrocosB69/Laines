import { IsArray, IsIn, IsOptional, IsString, Matches } from 'class-validator';

const APPOINTMENT_TYPES = ['primeira_consulta', 'retorno'] as const;

export class RemarcarAgendamentoDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/)
  time!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evaluations?: string[];

  @IsOptional()
  @IsString()
  @IsIn(APPOINTMENT_TYPES)
  appointmentType?: string;
}
