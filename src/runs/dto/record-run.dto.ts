import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class GpsPoint {
  @ApiProperty({ example: 40.7128 })
  @IsNumber()
  latitude: number;

  @ApiProperty({ example: -74.0060 })
  @IsNumber()
  longitude: number;
}

export class RecordRunDto {
  @ApiProperty({ example: '65eaf...', required: false })
  @IsString()
  @IsOptional()
  missionId?: string;

  @ApiProperty({ example: 3.2 })
  @IsNumber()
  @IsNotEmpty()
  distance: number;

  @ApiProperty({ example: '9:18' })
  @IsString()
  @IsNotEmpty()
  pace: string;

  @ApiProperty({ example: '29:45' })
  @IsString()
  @IsNotEmpty()
  duration: string;

  @ApiProperty({ example: 298 })
  @IsNumber()
  @IsNotEmpty()
  calories: number;

  @ApiProperty({ example: 32, required: false })
  @IsNumber()
  @IsOptional()
  pointsEarned?: number;

  @ApiProperty({ example: 'Feeling great', enum: ['Feeling great', 'A little tired', 'Something hurts'] })
  @IsString()
  @IsOptional()
  healthFeeling?: string;

  @ApiProperty({ type: [GpsPoint] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GpsPoint)
  gpsTrack: GpsPoint[];
}
