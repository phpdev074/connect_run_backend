import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsEnum, IsString, IsOptional } from 'class-validator';

export class CreateRunInviteDto {
  @ApiProperty({ example: 'Virtual_Run', enum: ['Virtual_Run', 'In_Person_Run'] })
  @IsNotEmpty()
  @IsEnum(['Virtual_Run', 'In_Person_Run'])
  type: string;

  @ApiProperty({ example: '2026-03-28' })
  @IsNotEmpty()
  @IsString()
  date: string;

  @ApiProperty({ example: '8:00 AM' })
  @IsNotEmpty()
  @IsString()
  time: string;

  @ApiProperty({ example: 'Riverside Loop', required: false })
  @IsOptional()
  @IsString()
  route?: string;

  @ApiProperty({ example: 'Central Park South Entrance', required: false })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({ example: 'Ready for our first run together?', required: false })
  @IsOptional()
  @IsString()
  message?: string;
}
