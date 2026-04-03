import { IsEmail, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsEmail()
  email: string;

  @MinLength(6)
  newPassword: string;
}
