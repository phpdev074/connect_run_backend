import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsDateString } from 'class-validator';

export class UpdateChatDto {
  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  isLocked?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  unlockConditionMet?: boolean;

  @ApiPropertyOptional({ example: '2024-03-29T00:00:00Z' })
  @IsDateString()
  @IsOptional()
  expiresAt?: string;
}
