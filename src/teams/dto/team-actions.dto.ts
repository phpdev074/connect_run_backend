import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsArray, IsNumber, IsOptional } from 'class-validator';

export class InviteMembersDto {
  @ApiProperty({ example: ['65eaf...'], type: [String] })
  @IsArray()
  @IsNotEmpty()
  userIds: string[];
}

export class JoinTeamDto {
  @ApiProperty({ example: 'abc-def-ghi', required: false })
  @IsString()
  @IsOptional()
  joinCode?: string;
}

export class LeaveTeamDto {
  @ApiProperty({ example: true })
  @IsString()
  @IsNotEmpty()
  message = '';
}

export class AcceptInviteDto {
  @ApiProperty({ example: true })
  @IsString()
  @IsNotEmpty()
  message = '';
}

export class DeclineInviteDto {
  @ApiProperty({ example: true })
  @IsString()
  @IsNotEmpty()
  message = '';
}

export class UpdateTeamMilesDto {
  @ApiProperty({ example: 12.5 })
  @IsNumber()
  @IsNotEmpty()
  miles: number;
}

export class UpdateCaptainDto {
  @ApiProperty({ example: '65eaf...' })
  @IsString()
  @IsNotEmpty()
  userId: string;
}

export class AddChallengeDto {
  @ApiProperty({ example: 'Winter Mileage Challenge' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: '2026-09-10', required: false })
  @IsString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({ example: '2026-10-10', required: false })
  @IsString()
  @IsOptional()
  endDate?: string;

  @ApiProperty({ example: 100, required: false })
  @IsNumber()
  @IsOptional()
  targetCount?: number;
}
