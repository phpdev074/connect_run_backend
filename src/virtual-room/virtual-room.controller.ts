import { Controller, Get, Post, Body, Req, UseGuards, Param, Patch, HttpStatus } from '@nestjs/common';
import { VirtualRoomService } from './virtual-room.service';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiBody } from '@nestjs/swagger';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomStatsDto } from './dto/update-room-stats.dto';

@ApiTags('Virtual Room')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('virtual-room')
export class VirtualRoomController {
  constructor(private readonly virtualRoomService: VirtualRoomService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new virtual run session' })
  @ApiBody({ type: CreateRoomDto })
  async createRoom(@Body() body: CreateRoomDto) {
    const data = await this.virtualRoomService.createRoom(body);
    return {
      statusCode: HttpStatus.CREATED,
      success: true,
      message: 'Virtual room created successfully',
      data,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get live details and stats of a room' })
  async getRoom(@Param('id') id: string) {
    const data = await this.virtualRoomService.getRoom(id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Room details fetched successfully',
      data,
    };
  }

  @Patch(':id/stats')
  @ApiOperation({ summary: 'Update your live stats during a session' })
  @ApiBody({ type: UpdateRoomStatsDto })
  async updateStats(@Req() req, @Param('id') id: string, @Body() stats: UpdateRoomStatsDto) {
    const data = await this.virtualRoomService.updateStats(id, req.user.id, stats);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Live stats updated',
      data,
    };
  }

  @Post(':id/end')
  @ApiOperation({ summary: 'Finalize and end the virtual run session' })
  async endRoom(@Param('id') id: string) {
    const data = await this.virtualRoomService.endRoom(id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Session ended successfully',
      data,
    };
  }
}
