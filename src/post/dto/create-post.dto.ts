import { IsString, IsOptional, IsArray, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

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
    example: ['https://api.velvetrabbit.io/uploads/1717589200-123456789.jpg'],
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
}
