import { Controller, Post, Get, Param, Req, UseGuards, HttpStatus } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaceService } from './pace.service';

@ApiTags('Saved Paces')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('saved-paces')
export class SavedPaceController {
  constructor(private readonly paceService: PaceService) {}

  @Post(':paceId/toggle')
  @ApiOperation({ summary: 'Toggle save/unsave for a pace' })
  async toggleSave(@Param('paceId') paceId: string, @Req() req) {
    const data = await this.paceService.toggleSavePace(req.user.id, paceId);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: data.saved ? 'Pace saved successfully' : 'Pace unsaved successfully',
      data,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all saved paces for the current user' })
  async getSavedPaces(@Req() req) {
    const data = await this.paceService.getSavedPaces(req.user.id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Saved paces fetched successfully',
      data,
    };
  }
}
