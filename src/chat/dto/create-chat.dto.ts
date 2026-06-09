import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsArray, ArrayMinSize, IsOptional } from 'class-validator';

export class CreateChatDto {
  @ApiProperty({ example: ['65eaf...'], description: 'Array of user IDs to start a chat with (2 for single, >2 for group)' })
  @IsArray()
  @ArrayMinSize(2)
  @IsString({ each: true })
  participants: string[];

  @ApiProperty({ example: 'Group Name', required: false })
  @IsOptional()
  @IsString()
  groupName?: string;

  @ApiProperty({ example: 'direct', enum: ['direct', 'group', 'community', 'pace'], required: false })
  @IsOptional()
  @IsString()
  type?: string;

  @ApiProperty({ example: '65eaf...', required: false })
  @IsOptional()
  @IsString()
  referenceId?: string;
}
