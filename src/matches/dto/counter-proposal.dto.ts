import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CounterProposalDto {
  @ApiProperty({ example: '2026-03-29' })
  @IsNotEmpty()
  @IsString()
  date: string;

  @ApiProperty({ example: '9:00 AM' })
  @IsNotEmpty()
  @IsString()
  time: string;
}
