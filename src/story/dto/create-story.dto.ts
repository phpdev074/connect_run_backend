import { IsString, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateStoryDto {
  @ApiProperty({
    description: 'URL of the story media (image or video)',
    example: '/uploads/stories/1717589200.jpg',
  })
  @IsNotEmpty()
  @IsString()
  mediaUrl: string;

  @ApiPropertyOptional({
    description: 'Type of the story media (e.g., image, video)',
    example: 'image',
    default: 'image',
  })
  @IsOptional()
  @IsString()
  mediaType?: string;
}
