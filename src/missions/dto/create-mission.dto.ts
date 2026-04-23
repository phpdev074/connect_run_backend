import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, IsDateString } from 'class-validator';

export class CreateMissionDto {
  @ApiProperty({ example: 'Tempo Tuesday' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'Tempo' })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({ example: 3.0 })
  @IsNumber()
  @IsNotEmpty()
  distance: number;

  @ApiProperty({ example: 3.0 })
  @IsNumber()
  @IsNotEmpty()
  goal: number;

  @ApiProperty({ example: 50, required: false })
  @IsNumber()
  @IsOptional()
  points?: number;

  @ApiProperty({ example: '65eaf...', required: false })
  @IsString()
  @IsOptional()
  partnerId?: string;

  @ApiProperty({ example: '2024-03-22T00:00:00Z' })
  @IsDateString()
  @IsNotEmpty()
  date: string;

  @ApiProperty({ example: 'Virtual_Run', enum: ['Virtual_Run', 'In_Person_Run'], required: false })
  @IsString()
  @IsOptional()
  runType?: string;

  @ApiProperty({ example: '8:00 AM', required: false })
  @IsString()
  @IsOptional()
  scheduledTime?: string;

  @ApiProperty({ example: 10, required: false })
  @IsNumber()
  @IsOptional()
  pointsRequired?: number;

  @ApiProperty({ example: 'Ready for our first run together?', required: false })
  @IsString()
  @IsOptional()
  message?: string;

  @ApiProperty({ example: 'pending', enum: ['pending', 'accepted', 'declined'], required: false })
  @IsString()
  @IsOptional()
  inviteStatus?: string;
}
