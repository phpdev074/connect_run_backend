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
    description: 'Optional title of the story',
    example: 'My morning workout!',
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    description: 'Type of the story media (e.g., image, video)',
    example: 'image',
    default: 'image',
  })
  @IsOptional()
  @IsString()
  mediaType?: string;

  @ApiPropertyOptional({
    description: 'Local creation time of the story on the client device (ISO 8601 string)',
    example: '2026-06-29T17:59:10.000Z',
  })
  @IsOptional()
  @IsString()
  user_time?: string;
}
