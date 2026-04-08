import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LikeUserDto {
  @ApiProperty({ example: '65eaf...' })
  @IsString()
  @IsNotEmpty()
  targetId: string;
}
