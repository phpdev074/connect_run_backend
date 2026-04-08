import {
  Controller, Get, Post, Body, Req, UseGuards, Patch, Param, Query, HttpStatus,
} from '@nestjs/common';
import { MissionsService } from './missions.service';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth, ApiOperation, ApiTags, ApiBody, ApiQuery,
} from '@nestjs/swagger';
import { CreateMissionDto } from './dto/create-mission.dto';

@ApiTags('Missions')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('missions')
export class MissionsController {
  constructor(private readonly missionsService: MissionsService) { }

  @Get('daily')
  @ApiOperation({ summary: 'Get daily mission for a specific date (defaults to today)' })
  @ApiQuery({ name: 'date', required: false, type: String, example: '2026-04-08' })
  async getDailyMission(
    @Req() req,
    @Query('date') date?: string,
  ) {
    const data = await this.missionsService.getDailyMission(req.user.id, date);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Daily mission fetched successfully',
      data,
    };
  }

  @Get('weekly-program')
  @ApiOperation({ summary: 'Get program for a specific week (defaults to current week)' })
  @ApiQuery({ name: 'date', required: false, type: String, example: '2026-04-08' })
  async getWeekly(
    @Req() req,
    @Query('date') date?: string,
  ) {
    const data = await this.missionsService.getWeeklyProgram(req.user.id, date);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Weekly program fetched successfully',
      data,
    };
  }

  @Get('history')
  @ApiOperation({ summary: 'Get complete mission history with pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  async getHistory(
    @Req() req,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    const data = await this.missionsService.getMissionHistory(req.user.id, page, limit);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Mission history fetched successfully',
      data,
    };
  }

  @Post()
  @ApiOperation({ summary: 'Create a new mission (for testing/admin)' })
  @ApiBody({ type: CreateMissionDto })
  async createMission(@Req() req, @Body() body: CreateMissionDto) {
    const data = await this.missionsService.createMission(req.user.id, body);
    return {
      statusCode: HttpStatus.CREATED,
      success: true,
      message: 'Mission created successfully',
      data,
    };
  }
}
