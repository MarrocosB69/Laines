import { IsString, MaxLength, MinLength } from 'class-validator';

export class AdicionarMensagemProfessorDto {
  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  texto!: string;
}
