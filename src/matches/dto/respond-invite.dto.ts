import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';

export class RespondInviteDto {
  @ApiProperty({ example: 'accepted', enum: ['accepted', 'declined'] })
  @IsEnum(['accepted', 'declined'])
  @IsNotEmpty()
  status: 'accepted' | 'declined';
}
