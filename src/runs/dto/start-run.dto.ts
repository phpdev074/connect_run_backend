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
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  matchId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  missionId?: string;

  @ApiProperty({ example: 3.2, required: false })
  @IsNumber()
  @IsOptional()
  distance?: number;

  @ApiProperty({ example: '9:18', required: false })
  @IsString()
  @IsOptional()
  pace?: string;

  @ApiProperty({ example: '29:45', required: false })
  @IsString()
  @IsOptional()
  duration?: string;

  @ApiProperty({ example: 298, required: false })
  @IsNumber()
  @IsOptional()
  calories?: number;

  @ApiProperty({ example: 32, required: false })
  @IsNumber()
  @IsOptional()
  pointsEarned?: number;

  @ApiProperty({ example: 'Feeling great', enum: ['Feeling great', 'A little tired', 'Something hurts'], required: false })
  @IsString()
  @IsOptional()
  healthFeeling?: string;

  @ApiProperty({ type: [GpsPoint], required: false })
  @IsArray()
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => GpsPoint)
  gpsTrack?: GpsPoint[];
}
