import { Controller, Get, Post, Body, Req, UseGuards, HttpStatus, Query } from '@nestjs/common';
import { RunsService } from './runs.service';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiBody } from '@nestjs/swagger';
import { RecordRunDto } from './dto/record-run.dto';

@ApiTags('Runs')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('runs')
export class RunsController {
  constructor(private readonly runsService: RunsService) {}

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
}
