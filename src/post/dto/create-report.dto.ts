import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateReportDto {
  @ApiPropertyOptional({ description: 'Reason for reporting the post', example: 'Inappropriate content' })
  @IsOptional()
  @IsString()
  reason?: string;
}
