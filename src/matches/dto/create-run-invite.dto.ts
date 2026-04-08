import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsEnum, IsString, IsOptional } from 'class-validator';

export class CreateRunInviteDto {
  @ApiProperty({ example: 'Virtual Run', enum: ['Virtual Run', 'In-Person Run'] })
  @IsNotEmpty()
  @IsEnum(['Virtual Run', 'In-Person Run'])
  type: string;

  @ApiProperty({ example: 'Today' })
  @IsNotEmpty()
  @IsString()
  date: string;

  @ApiProperty({ example: '8:00 AM' })
  @IsNotEmpty()
  @IsString()
  time: string;

  @ApiProperty({ example: 'Ready for our first run together?', required: false })
  @IsOptional()
  @IsString()
  message?: string;
}
