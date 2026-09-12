import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RecoverPasswordDto {
  @IsString()
  @Matches(/^[a-f0-9]{64}$/, { message: 'Link invalido ou expirado.' })
  token!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'Senha deve conter ao menos 1 letra maiuscula, 1 minuscula e 1 numero.'
  })
  newPassword!: string;
}
