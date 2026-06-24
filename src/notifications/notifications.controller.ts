import { Controller, Post, Body, Get, Req, UseGuards, Query, Patch, Param, Delete } from '@nestjs/common';
import { NotificationsPage, NotificationsService } from './notifications.service';
import { ApiTags, ApiOperation, ApiBody, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { BulkDeleteNotificationsDto } from './dto/bulk-delete-notifications.dto';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) { }

  @Get('my-notifications')
  @ApiOperation({ summary: 'Get current user notifications' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getMyNotifications(
    @Req() req,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ): Promise<NotificationsPage> {
    return await this.notificationsService.getUserNotifications(req.user.id, page, limit);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  async markAsRead(@Param('id') id: string) {
    return await this.notificationsService.markAsRead(id);
  }

  @Post('mark-all-read')
  @ApiOperation({ summary: 'Mark all notifications as read' })
  async markAllRead(@Req() req) {
    return await this.notificationsService.markAllAsRead(req.user.id);
  }

  @Delete('bulk-delete')
  @ApiOperation({ summary: 'Bulk soft-delete notifications' })
  @ApiBody({ type: BulkDeleteNotificationsDto })
  async bulkDelete(@Req() req, @Body() body: BulkDeleteNotificationsDto) {
    const result = await this.notificationsService.bulkDelete(req.user.id, body.notificationIds);
    return {
      statusCode: 200,
      success: true,
      message: 'Notifications soft deleted successfully',
      data: result,
    };
  }

  // --- Test Endpoints (Consider removing in production) ---

  @Post('test-push')
  @ApiOperation({ summary: 'Send a test push notification and save it' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'string', example: 'user-id' },
        title: { type: 'string', example: 'Test Title' },
        body: { type: 'string', example: 'Test Body' },
        type: { type: 'string', example: 'TEST' },
        data: { type: 'object', example: { key: 'value' } },
      },
      required: ['userId', 'title', 'body', 'type'],
    },
  })
  async sendTestPush(
    @Body('userId') userId: string,
    @Body('title') title: string,
    @Body('body') body: string,
    @Body('type') type: string,
    @Body('data') data?: any,
  ) {
    return await this.notificationsService.sendAndSave(userId, title, body, type, data);
  }
}
