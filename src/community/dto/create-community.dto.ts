import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsArray } from 'class-validator';

export class CreateCommunityDto {
  @ApiProperty({ example: 'Morning Runners' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'A community for morning run enthusiasts.', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 'https://example.com/image.png', required: false })
  @IsString()
  @IsOptional()
  image?: string;

  @ApiProperty({ example: ['65eaf...'], type: [String], required: false })
  @IsArray()
  @IsOptional()
  members?: string[];
}
