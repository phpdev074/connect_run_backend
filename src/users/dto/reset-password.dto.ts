import { IsEmail, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsEmail()
  email: string;

  @MinLength(5)
  newPassword: string;
}
