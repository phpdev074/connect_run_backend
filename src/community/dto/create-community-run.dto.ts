import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsDateString, IsNumber } from 'class-validator';

export class CreateCommunityRunDto {
  @ApiProperty({ example: 'Saturday Morning Jog' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'A casual 5k jog around the park.', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: '2026-06-10T08:00:00.000Z' })
  @IsDateString()
  @IsNotEmpty()
  date: string;

  @ApiProperty({ example: 5, required: false })
  @IsNumber()
  @IsOptional()
  distance?: number;

  @ApiProperty({ example: '30:00', required: false })
  @IsString()
  @IsOptional()
  duration?: string;

  @ApiProperty({ example: '6:00', required: false })
  @IsString()
  @IsOptional()
  pace?: string;

  @ApiProperty({ example: 'Central Park Entrance', required: false })
  @IsString()
  @IsOptional()
  location?: string;
}
