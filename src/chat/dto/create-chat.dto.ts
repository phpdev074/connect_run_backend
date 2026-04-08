import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateChatDto {
  @ApiProperty({ example: '65eaf...', description: 'ID of the user to start a chat with' })
  @IsString()
  @IsNotEmpty()
  targetId: string;
}
