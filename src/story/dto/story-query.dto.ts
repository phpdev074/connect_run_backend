import { IsNumberString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class StoryQueryDto {
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
}
