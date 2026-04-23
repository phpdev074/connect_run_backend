import { Controller, Get, Post, Body, Req, UseGuards, HttpStatus, Query, Param } from '@nestjs/common';
import { RunsService } from './runs.service';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiBody, ApiQuery } from '@nestjs/swagger';
import { RecordRunDto } from './dto/record-run.dto';
import { StartRunDto } from './dto/start-run.dto';

@ApiTags('Runs')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('runs')
export class RunsController {
  constructor(private readonly runsService: RunsService) { }

  @Get('setup')
  @ApiOperation({ summary: 'Get setup details for a run (solo or match)' })
  @ApiQuery({ name: 'matchId', required: false, type: String })
  async getRunSetup(@Req() req, @Query('matchId') matchId?: string) {
    const data = await this.runsService.getRunSetup(req.user.id, matchId);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Run setup fetched successfully',
      data,
    };
  }

  @Post('start')
  @ApiOperation({ summary: 'Start a run (solo or matched) to get run ID for socket tracking' })
  @ApiBody({ type: StartRunDto })
  async startRun(@Req() req, @Body() body: StartRunDto) {
    const data = await this.runsService.startRun(req.user.id, body.matchId);
    return {
      statusCode: HttpStatus.CREATED,
      success: true,
      message: 'Run started successfully',
      data,
    };
  }

  @Post('record')
  @ApiOperation({ summary: 'Record a run after completion' })
  @ApiBody({ type: RecordRunDto })
  async recordRun(@Req() req, @Body() body: RecordRunDto) {
    const data = await this.runsService.recordRun(req.user.id, body);
    return {
      statusCode: HttpStatus.CREATED,
      success: true,
      message: 'Run recorded successfully',
      data,
    };
  }

  @Get('history')
  @ApiOperation({ summary: 'Get run history for current user' })
  async getHistory(@Req() req) {
    const data = await this.runsService.getUserRuns(req.user.id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Run history fetched successfully',
      data,
    };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get total miles, points, and current streak' })
  async getStats(@Req() req) {
    const data = await this.runsService.getStats(req.user.id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'User stats fetched successfully',
      data,
    };
  }

  @Get('nearby-spots')
  @ApiOperation({ summary: 'Get AI-picked spots nearby after run completion' })
  async getNearbySpots(@Query('lat') lat: number, @Query('lng') lng: number) {
    const data = await this.runsService.getNearbySpots(lat, lng);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Nearby spots fetched successfully',
      data,
    };
  }

  // ✅ NEW API
  @Get(':runId/path')
  @ApiOperation({ summary: 'Get run path for map' })
  async getRunPath(@Param('runId') runId: string) {
    const data = await this.runsService.getRunPath(runId);

    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Run path fetched successfully',
      data,
    };
  }
}
