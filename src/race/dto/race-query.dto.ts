import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { IsOptional, IsString, IsNumber, Min, IsBoolean } from 'class-validator';

export class RaceQueryDto {
  @ApiPropertyOptional({
    description: 'Search query across race name, organizer, location, city, tags, distance',
    example: 'Austin',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter by city or location',
    example: 'Austin, TX',
  })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({
    description: 'Filter by city',
    example: 'Austin',
  })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({
    description: 'Filter by race type (All Races, In-Person, Virtual)',
    example: 'In-Person',
  })
  @IsOptional()
  @IsString()
  raceType?: string;

  @ApiPropertyOptional({
    description: 'Filter by distance (Any Distance, 5K, 10K, Half, Full, Other)',
    example: '5K',
  })
  @IsOptional()
  @IsString()
  distance?: string;

  @ApiPropertyOptional({
    description: 'Filter by tag (e.g. Marathon, Road, Certified, Chip Timed)',
    example: 'Marathon',
  })
  @IsOptional()
  @IsString()
  tag?: string;

  @ApiPropertyOptional({
    description: 'Tab selection: published, my-races, joined',
    example: 'published',
  })
  @IsOptional()
  @IsString()
  tab?: string;

  @ApiPropertyOptional({
    description: 'Filter only featured races',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by status (upcoming, ongoing, completed, cancelled, all)',
    example: 'upcoming',
    default: 'upcoming',
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'Sort by field (date, createdAt, participantsCount)',
    example: 'date',
    default: 'date',
  })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({
    description: 'Sort order (asc, desc)',
    example: 'asc',
    default: 'asc',
  })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';

  @ApiPropertyOptional({
    description: 'Page number for pagination',
    default: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    default: 10,
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 10;
}
