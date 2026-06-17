import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCommentDto {
  @ApiProperty({ description: 'Text content of the comment', example: 'Great post!' })
  @IsNotEmpty()
  @IsString()
  text: string;

  @ApiPropertyOptional({ description: 'Parent comment ID if replying to a comment', example: '60c72b2f9b1d8b2d1c888888' })
  @IsOptional()
  @IsString()
  parentCommentId?: string;
}

