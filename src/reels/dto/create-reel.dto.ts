import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, IsArray } from 'class-validator';

export class CreateReelDto {
  @ApiProperty({ example: 'https://example.com/video.mp4' })
  @IsNotEmpty()
  @IsString()
  videoUrl: string;

  @ApiProperty({ example: 'https://example.com/thumb.jpg', required: false })
  @IsOptional()
  @IsString()
  thumbnailUrl?: string;

  @ApiProperty({ example: 'Morning trail run!', required: false })
  @IsOptional()
  @IsString()
  caption?: string;

  @ApiProperty({ example: ['MorningMilars', 'MorningRuns'], required: false })
  @IsOptional()
  @IsArray()
  hashtags?: string[];

  @ApiProperty({ example: 'Central Park, NY', required: false })
  @IsOptional()
  @IsString()
  location?: string;
}
