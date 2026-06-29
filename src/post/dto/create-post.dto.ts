import { IsString, IsOptional, IsArray, IsBoolean, IsNumber, ValidateNested } from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class LocationDto {
  @ApiProperty({ example: 'Point', default: 'Point' })
  @IsString()
  type: string;

  @ApiProperty({ type: [Number], example: [77.1025, 28.7041], description: '[longitude, latitude]' })
  @IsArray()
  @IsNumber({}, { each: true })
  coordinates: [number, number];
}

export class CreatePostDto {
  @ApiPropertyOptional({ description: 'Title of the post', example: 'My Travel Log' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Text content of the post', example: 'This is my first post!' })
  @IsOptional()
  @IsString()
  text?: string;

  @ApiPropertyOptional({
    description: 'Array of image URLs. Used if images are pre-uploaded.',
    type: [String],
    example: ['https://api.connectrun.io/uploads/1717589200-123456789.jpg'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  urls?: string[];

  @ApiPropertyOptional({ description: 'Type of the post (e.g., image, video)', example: 'image', default: 'image' })
  @IsOptional()
  @IsString()
  postType?: string;

  @ApiPropertyOptional({ description: 'Status of the post', example: true, default: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({
    description: 'List of tags associated with the post',
    type: [String],
    example: ['running', 'morning', 'cardio'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description: 'List of user IDs tagged in the post',
    type: [String],
    example: ['6a3bd940bfc8bd0844f330f0', '6a312c52049dcede594381e4'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tagged_users?: string[];

  @ApiPropertyOptional({ type: LocationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto;
}
