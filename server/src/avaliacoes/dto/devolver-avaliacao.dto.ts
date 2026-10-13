import { IsString, MaxLength, MinLength } from 'class-validator';

export class DevolverAvaliacaoDto {
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  observacao!: string;
}
