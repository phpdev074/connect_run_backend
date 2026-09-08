import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { IsOptional, IsString, IsNumber, Min, IsIn } from 'class-validator';

export class LeaderboardQueryDto {
  @ApiPropertyOptional({
    description:
      'Timeframe for leaderboard stats: weekly (or this_week / thisWeek), monthly, yearly, all (or all_time / allTime)',
    enum: [
      'weekly',
      'monthly',
      'yearly',
      'all',
    ],
    default: 'weekly',
    example: 'weekly',
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const normalized = value.toLowerCase().trim().replace('-', '_');
      if (
        normalized === 'week'
      )
        return 'weekly';
      if (
        normalized === 'all'
      )
        return 'all';
      if (
        normalized === 'month'
      )
        return 'monthly';
      if (
        normalized === 'year'
      )
        return 'yearly';
      return normalized;
    }
    return value;
  })
  @IsIn([
    'weekly',
    'monthly',
    'yearly',
    'all',
  ])
  timeframe?: string = 'weekly';

  @ApiPropertyOptional({
    description: 'Sorting metric: points, distance (or total_miles), runs',
    enum: ['points', 'distance', 'total_miles', 'runs'],
    default: 'points',
    example: 'points',
  })
  @IsOptional()
  @IsString()
  @IsIn(['points', 'distance', 'total_miles', 'runs'])
  sortBy?: 'points' | 'distance' | 'total_miles' | 'runs' = 'points';

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
    description: 'Number of runners per page',
    default: 20,
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;
}
