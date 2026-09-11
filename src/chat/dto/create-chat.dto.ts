import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, IsOptional, IsEnum } from 'class-validator';

export class CreateChatDto {
  @ApiProperty({
    example: ['65eaf...'],
    description: 'Array of user IDs to start a chat with (optional if groupId, teamId, or targetUserId is provided)',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  participants?: string[];

  @ApiProperty({ example: '65eaf...', description: 'Target user ID for 1-on-1 direct chat', required: false })
  @IsOptional()
  @IsString()
  targetUserId?: string;

  @ApiProperty({ example: '65eaf...', description: 'Group ID to start or get group chat', required: false })
  @IsOptional()
  @IsString()
  groupId?: string;

  @ApiProperty({ example: '65eaf...', description: 'Team ID to start or get team chat', required: false })
  @IsOptional()
  @IsString()
  teamId?: string;

  @ApiProperty({ example: '65eaf...', description: 'Race ID to start or get race chat', required: false })
  @IsOptional()
  @IsString()
  raceId?: string;

  @ApiProperty({ example: 'Group Name', required: false })
  @IsOptional()
  @IsString()
  groupName?: string;

  @ApiProperty({ example: 'https://...', required: false })
  @IsOptional()
  @IsString()
  groupImage?: string;

  @ApiProperty({ example: 'direct', enum: ['direct', 'group', 'team', 'race', 'community', 'pace'], required: false })
  @IsOptional()
  @IsEnum(['direct', 'group', 'team', 'race', 'community', 'pace'])
  type?: string;

  @ApiProperty({ example: '65eaf...', description: 'Reference ID (Group ID, Team ID, or Race ID)', required: false })
  @IsOptional()
  @IsString()
  referenceId?: string;
}

