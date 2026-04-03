import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, IsNotEmpty } from 'class-validator';

export class LoginDto {
  
  @ApiProperty({
    example: 'john@mail.com',
    description: 'Registered user email address',
    format: 'email',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: 'password123',
    description: 'Account password',
    minLength: 5,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(5)
  password: string;
}