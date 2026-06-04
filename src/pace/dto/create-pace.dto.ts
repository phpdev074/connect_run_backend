import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsArray, IsNumber } from 'class-validator';

export class CreateGroupDto {
  @ApiProperty({ example: 'Morning Runners' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'A group for morning run enthusiasts.', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 'https://example.com/image.png', required: false })
  @IsString()
  @IsOptional()
  image?: string;

  @ApiProperty({ example: '4:30 - 5:30 min/km', required: false })
  @IsString()
  @IsOptional()
  paceRange?: string;

  @ApiProperty({ example: 50, required: false })
  @IsNumber()
  @IsOptional()
  maxMembers?: number;

  @ApiProperty({ example: 'public', required: false })
  @IsString()
  @IsOptional()
  visibility?: string;

  @ApiProperty({ example: ['65eaf...'], type: [String], required: false })
  @IsArray()
  @IsOptional()
  members?: string[];
}
