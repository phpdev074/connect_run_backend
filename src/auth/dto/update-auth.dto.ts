import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { RegisterDto } from './create-auth.dto';

export class UpdateProfileDto extends PartialType(RegisterDto) { }