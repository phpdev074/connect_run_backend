import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsEnum, IsArray } from 'class-validator';

export class CreateRoomDto {
  @ApiProperty({ example: '65eaf...', required: false })
  @IsString()
  @IsOptional()
  chatId?: string;

  @ApiProperty({ example: '65eaf...', required: false })
  @IsString()
  @IsOptional()
  missionId?: string;

  @ApiProperty({ example: 'Dating', enum: ['Dating', 'Group'] })
  @IsEnum(['Dating', 'Group'])
  @IsOptional()
  type?: string = 'Dating';

  @ApiProperty({ example: ['65eaf...'], description: 'Array of user IDs to join the room' })
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  participantIds: string[];
}
