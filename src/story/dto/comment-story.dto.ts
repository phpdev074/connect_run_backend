import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CommentStoryDto {
  @ApiProperty({
    description: 'The comment text',
    example: 'Awesome story!',
  })
  @IsNotEmpty()
  @IsString()
  text: string;
}
