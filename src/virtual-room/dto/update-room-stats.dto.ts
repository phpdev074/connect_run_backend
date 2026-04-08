import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class UpdateRoomStatsDto {
  @ApiProperty({ example: 1.8 })
  @IsNumber()
  @IsNotEmpty()
  distance: number;

  @ApiProperty({ example: '9:24' })
  @IsString()
  @IsNotEmpty()
  pace: string;
}
