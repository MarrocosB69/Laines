import { IsEmail, IsString, Matches, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'Senha deve conter ao menos 1 letra maiuscula, 1 minuscula e 1 numero.'
  })
  password!: string;

  @IsString()
  @MinLength(2)
  name!: string;
}
