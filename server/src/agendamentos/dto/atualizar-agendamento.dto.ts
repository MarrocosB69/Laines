import {
  IsArray,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches
} from 'class-validator';

const APPOINTMENT_STATUS = ['agendada', 'realizada', 'remarcada', 'falta'] as const;
const APPOINTMENT_TYPES = ['primeira_consulta', 'retorno'] as const;

export class AtualizarAgendamentoDto {
  @IsOptional()
  @IsUUID()
  pacienteId?: string;

  @IsOptional()
  @IsString()
  pacienteNome?: string;

  @IsOptional()
  @IsUUID()
  alunoId?: string;

  @IsOptional()
  @IsString()
  alunoNome?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  time?: string;

  @IsOptional()
  @IsString()
  @IsIn(APPOINTMENT_TYPES)
  appointmentType?: string;

  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  evaluations?: string[];

  @IsOptional()
  @IsString()
  @IsIn(APPOINTMENT_STATUS)
  status?: string;

  @IsOptional()
  @IsUUID()
  origemId?: string;

  @IsOptional()
  @IsDateString()
  remarcadaEm?: string;

  @IsOptional()
  @IsDateString()
  remarcadaPara?: string;

  @IsOptional()
  @IsDateString()
  completedAt?: string;

  @IsOptional()
  @IsDateString()
  faltouEm?: string;
}
