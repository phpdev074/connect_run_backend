import { IsNumberString, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PostQueryDto {
  @ApiPropertyOptional({
    example: '1',
    description: 'Page number (default: 1)',
  })
  @IsOptional()
  @IsNumberString()
  page?: string;

  @ApiPropertyOptional({
    example: '10',
    description: 'Number of records per page (default: 10)',
  })
  @IsOptional()
  @IsNumberString()
  limit?: string;

  @ApiPropertyOptional({
    example: '77.1025',
    description: 'Longitude for location search',
  })
  @IsOptional()
  @IsNumberString()
  longitude?: string;

  @ApiPropertyOptional({
    example: '28.7041',
    description: 'Latitude for location search',
  })
  @IsOptional()
  @IsNumberString()
  latitude?: string;

  @ApiPropertyOptional({
    example: '50',
    description: 'Max distance in kilometers (optional, proximity search only applied if > 0)',
  })
  @IsOptional()
  @IsNumberString()
  maxDistance?: string;

  @ApiPropertyOptional({
    enum: ['image', 'video'],
    description: 'Filter posts by type: image or video (optional)',
  })
  @IsOptional()
  @IsString()
  postType?: string;
}

