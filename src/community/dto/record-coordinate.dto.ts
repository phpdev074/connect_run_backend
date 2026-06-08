import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber } from 'class-validator';

export class RecordCoordinateDto {
  @ApiProperty({ example: 40.7128 })
  @IsNumber()
  @IsNotEmpty()
  latitude: number;

  @ApiProperty({ example: -74.0060 })
  @IsNumber()
  @IsNotEmpty()
  longitude: number;
}
