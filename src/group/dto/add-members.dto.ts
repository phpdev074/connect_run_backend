import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty } from 'class-validator';

export class AddMembersDto {
  @ApiProperty({ example: ['65eaf...'], type: [String] })
  @IsArray()
  @IsNotEmpty()
  members: string[];
}
