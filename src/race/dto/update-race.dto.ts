import { PartialType } from '@nestjs/swagger';
import { CreateRaceDto } from './create-race.dto';
import { IsEnum, IsOptional, IsString, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { RaceStatus } from '../entities/race.entity';

export class UpdateRaceDto extends PartialType(CreateRaceDto) {
  @ApiPropertyOptional({
    description: 'Status of the race',
    enum: RaceStatus,
    example: RaceStatus.UPCOMING,
  })
  @IsOptional()
  @IsEnum(RaceStatus)
  status?: RaceStatus;

  @ApiPropertyOptional({
    description: 'Whether the race is active',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
