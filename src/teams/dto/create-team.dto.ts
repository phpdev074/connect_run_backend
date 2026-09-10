import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsArray, IsNumber } from 'class-validator';

export class CreateTeamDto {
  @ApiProperty({ example: 'Morning Mile Crushers' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'Early birds who get their miles in before 8 AM.', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 'https://example.com/image.png', required: false })
  @IsString()
  @IsOptional()
  image?: string;

  @ApiProperty({ example: '7:30-9:00/mi', required: false })
  @IsString()
  @IsOptional()
  paceRange?: string;

  @ApiProperty({ example: 25, required: false })
  @IsNumber()
  @IsOptional()
  maxMembers?: number;

  @ApiProperty({ example: 'public', required: false })
  @IsString()
  @IsOptional()
  visibility?: string;

  @ApiProperty({ example: 'abc-def-ghi', required: false })
  @IsString()
  @IsOptional()
  joinCode?: string;

  @ApiProperty({ example: ['65eaf...'], type: [String], required: false })
  @IsArray()
  @IsOptional()
  members?: string[];
}
