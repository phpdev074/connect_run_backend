import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReactStoryDto {
  @ApiProperty({
    description: 'The reaction emoji or string',
    example: '🔥',
  })
  @IsNotEmpty()
  @IsString()
  reaction: string;
}
