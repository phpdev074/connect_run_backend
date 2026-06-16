import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCommentDto {
  @ApiProperty({ description: 'Text content of the comment', example: 'Great post!' })
  @IsNotEmpty()
  @IsString()
  text: string;
}
