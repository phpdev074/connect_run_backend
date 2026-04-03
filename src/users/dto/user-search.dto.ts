import {  IsNumberString, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';


export class UserSearchDto {

  @ApiPropertyOptional({
    description: 'Search by name, email, or phone',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    example: '1',
    description: 'Page number (default: 1)',
  })
  @IsOptional()
  @IsNumberString()
  page?: string;

  @ApiPropertyOptional({
    example: '10',
    description: 'Number of records per page (default: 10)',
  })
  @IsOptional()
  @IsNumberString()
  limit?: string;
}
