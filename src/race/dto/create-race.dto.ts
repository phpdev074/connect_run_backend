import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsDateString,
  IsArray,
  IsBoolean,
  IsNumber,
} from 'class-validator';
import { RaceType } from '../entities/race.entity';

export class CreateRaceDto {
  @ApiProperty({
    description: 'Name of the race',
    example: 'Austin Marathon 2026',
  })
  @IsNotEmpty({ message: 'Race name is required' })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Organizer or organization hosting the race',
    example: 'Austin Runners Association',
  })
  @IsNotEmpty({ message: 'Organizer / Organization is required' })
  @IsString()
  organizer: string;

  @ApiProperty({
    description: 'Race type (In-Person or Virtual)',
    enum: RaceType,
    example: RaceType.IN_PERSON,
  })
  @IsNotEmpty({ message: 'Race type is required' })
  @IsString()
  raceType: string;

  @ApiProperty({
    description: 'Distance of the race (e.g., 5K, 10K, Half Marathon, 26.2 mi)',
    example: '26.2 mi',
  })
  @IsNotEmpty({ message: 'Distance is required' })
  @IsString()
  distance: string;

  @ApiProperty({
    description: 'Date and time of the race',
    example: '2026-02-15T08:00:00.000Z',
  })
  @IsNotEmpty({ message: 'Date is required' })
  @IsDateString({}, { message: 'Date must be a valid ISO-8601 date string' })
  date: string;

  @ApiProperty({
    description: 'Location or address of the race',
    example: 'Austin, TX',
  })
  @IsNotEmpty({ message: 'Location / Address is required' })
  @IsString()
  location: string;

  @ApiPropertyOptional({
    description: 'City of the race',
    example: 'Austin',
  })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({
    description: 'State / Province of the race',
    example: 'TX',
  })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({
    description: 'Registration fee (e.g., $95 or Free)',
    example: '$95',
    default: 'Free',
  })
  @IsOptional()
  @IsString()
  registrationFee?: string;

  @ApiPropertyOptional({
    description: 'Detailed description of the race course, perks, awards, etc.',
    example:
      'The premier marathon through the heart of Austin. Scenic course through downtown, South Congress, and Lady Bird Lake.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: 'Banner image or logo URL for the race',
    example: 'https://api.connectrun.io/uploads/race-banner.jpg',
  })
  @IsOptional()
  @IsString()
  bannerImage?: string;

  @ApiPropertyOptional({
    description: 'Tags for the race',
    type: [String],
    example: ['Marathon', 'Road', 'Certified', 'Chip Timed'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Whether this race is featured',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({
    description: 'Maximum capacity / spots available for the race',
    example: 6000,
  })
  @IsOptional()
  @IsNumber()
  maxSpots?: number;
}
