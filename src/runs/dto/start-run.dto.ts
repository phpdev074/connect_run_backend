import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';

class GpsPoint {
  @ApiProperty({ example: 40.7128 })
  @IsNumber()
  latitude: number;

  @ApiProperty({ example: -74.0060 })
  @IsNumber()
  longitude: number;
}

export class StartRunDto {
  @ApiProperty({ example: '65eaf...', required: false })
  @IsString()
  @IsOptional()
  matchId?: string;

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
