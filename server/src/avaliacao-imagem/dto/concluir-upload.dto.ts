import { IsNumber, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class ConcluirUploadDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100 * 1024 * 1024)
  tamanhoBytes?: number;

  @IsOptional()
  @IsString()
  @Matches(/^[a-fA-F0-9]{64}$/)
  sha256?: string;
}
