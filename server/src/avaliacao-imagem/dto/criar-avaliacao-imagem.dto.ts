import {
  Equals,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CriarAvaliacaoImagemDto {
  @IsUUID()
  pacienteId!: string;

  @IsNumber()
  @Min(20)
  @Max(350)
  peso!: number;

  @IsNumber()
  @Min(100)
  @Max(250)
  estatura!: number;

  @IsIn(['masculino', 'feminino'])
  sexo!: 'masculino' | 'feminino';

  @IsBoolean()
  @Equals(true, { message: 'O consentimento para captura das imagens e obrigatorio.' })
  consentimento!: true;

  @IsIn(['participante', 'responsavel_legal'])
  consentimentoTipo!: 'participante' | 'responsavel_legal';

  @IsOptional()
  @IsString()
  @Length(3, 160)
  consentimentoResponsavelNome?: string;

  @IsOptional()
  @IsNumber()
  @Min(3)
  @Max(100)
  arucoMarkerSizeCm?: number;

  @IsOptional()
  @IsString()
  @Matches(/^video\/(webm|mp4)(?:;.*)?$/i)
  videoMimeType?: string;
}
