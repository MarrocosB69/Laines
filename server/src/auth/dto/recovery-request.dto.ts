import { IsEmail, MaxLength } from 'class-validator';

export class RecoveryRequestDto {
  @IsEmail()
  @MaxLength(190)
  identifier!: string;
}
