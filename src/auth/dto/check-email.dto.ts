import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CheckEmailDto {
  @ApiProperty({
    description: 'Email address to check for existence',
    example: 'user@example.com',
  })
  @IsEmail({}, { message: 'Invalid email format' })
  email: string;
}
