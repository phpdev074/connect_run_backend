import { PartialType } from '@nestjs/swagger';
import { CreatePaceDto } from './create-pace.dto';

export class UpdatePaceDto extends PartialType(CreatePaceDto) { }
