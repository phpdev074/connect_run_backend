import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsArray, IsNumber, IsDateString, IsEnum } from 'class-validator';

export class CreatePaceDto {
  @ApiProperty({ example: 'Morning Runners' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'A group for morning run enthusiasts.', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 'Meet at Gate B, warm up for 10 mins, do 10k, cool down', required: false })
  @IsString()
  @IsOptional()
  runTravelPlan?: string;

  @ApiProperty({ example: 'Central Park Gate B', required: false })
  @IsString()
  @IsOptional()
  meetingLocation?: string;

  @ApiProperty({ example: '10 km', required: false })
  @IsString()
  @IsOptional()
  distance?: string;

  @ApiProperty({ example: '5:45/km', required: false })
  @IsString()
  @IsOptional()
  targetPace?: string;

  @ApiProperty({ example: 10, required: false })
  @IsNumber()
  @IsOptional()
  joinPrice?: number;

  @ApiProperty({ example: '2026-06-10T08:00:00.000Z', required: false })
  @IsDateString()
  @IsOptional()
  date?: string;

  @ApiProperty({ example: '8:00 AM', required: false })
  @IsString()
  @IsOptional()
  time?: string;

  @ApiProperty({ example: 'upcoming', required: false })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiProperty({ example: ['65eaf...'], type: [String], required: false })
  @IsArray()
  @IsOptional()
  members?: string[];

  @ApiProperty({ example: 'in-person', enum: ['in-person', 'virtual'], required: false })
  @IsEnum(['in-person', 'virtual'])
  @IsOptional()
  runType?: string;
}
