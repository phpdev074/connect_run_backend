import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({ example: 'Hello Sarah!' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiProperty({ example: 'text', enum: ['text', 'image', 'invite', 'system'] })
  @IsEnum(['text', 'image', 'invite', 'system'])
  @IsOptional()
  type?: string = 'text';

  @ApiProperty({ example: { missionId: '65eaf...' }, required: false })
  @IsOptional()
  metadata?: any;
}
