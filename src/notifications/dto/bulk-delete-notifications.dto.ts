import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsString } from 'class-validator';

export class BulkDeleteNotificationsDto {
  @ApiProperty({ type: [String], description: 'List of notification IDs to soft delete' })
  @IsArray()
  @IsString({ each: true })
  notificationIds: string[];
}
