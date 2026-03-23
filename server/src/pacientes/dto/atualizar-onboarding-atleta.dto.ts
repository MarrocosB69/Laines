import { IsObject, IsOptional } from 'class-validator';

export class AtualizarOnboardingAtletaDto {
  @IsOptional()
  @IsObject()
  confirmacaoAtleta?: Record<string, unknown>;
}
