import { IsDateString, IsString, Matches, MinLength } from 'class-validator';

export class RecoverPasswordDto {
  @IsString()
  @MinLength(3)
  identifier!: string;

  @IsString()
  @Matches(/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/, {
    message: 'CPF invalido.'
  })
  cpf!: string;

  @IsDateString({}, {
    message: 'Data de nascimento invalida.'
  })
  dataNascimento!: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'Senha deve conter ao menos 1 letra maiuscula, 1 minuscula e 1 numero.'
  })
  newPassword!: string;
}
