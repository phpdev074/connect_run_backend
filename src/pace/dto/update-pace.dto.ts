import { PartialType } from '@nestjs/swagger';
import { CreateGroupDto } from './create-pace.dto';

export class UpdateGroupDto extends PartialType(CreateGroupDto) { }
