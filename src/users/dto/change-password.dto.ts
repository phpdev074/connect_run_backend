import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({
    description: 'The current password of the user',
    example: 'OldPassword123',
  })
  @IsString()
  oldPassword: string;

  @ApiProperty({
    description: 'The new password (minimum 6 characters)',
    example: 'NewPassword456',
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  newPassword: string;
}
