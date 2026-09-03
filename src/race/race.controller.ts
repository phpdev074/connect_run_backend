import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  UseGuards,
  Patch,
  Delete,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { RaceService } from './race.service';
import { CreateRaceDto } from './dto/create-race.dto';
import { UpdateRaceDto } from './dto/update-race.dto';
import { RaceQueryDto } from './dto/race-query.dto';

@ApiTags('Races')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('races')
export class RaceController {
  constructor(private readonly raceService: RaceService) {}

  @Post()
  @ApiOperation({ summary: 'Publish / Create a new race' })
  @ApiBody({ type: CreateRaceDto })
  async create(@Req() req, @Body() createRaceDto: CreateRaceDto): Promise<any> {
    const data = await this.raceService.create(req.user.id, createRaceDto);
    return {
      statusCode: HttpStatus.CREATED,
      success: true,
      message: 'Race published successfully',
      data,
    };
  }

  @Get()
  @ApiOperation({
    summary: 'Get all published races with search, filters (city, raceType, distance, tags) and pagination',
  })
  async findAll(@Req() req, @Query() query: RaceQueryDto): Promise<any> {
    const data = await this.raceService.findAll(req.user.id, query);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Races fetched successfully',
      data,
    };
  }

  @Get('featured')
  @ApiOperation({ summary: 'Get featured upcoming races' })
  async getFeatured(@Req() req): Promise<any> {
    const data = await this.raceService.getFeaturedRaces(req.user.id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Featured races fetched successfully',
      data,
    };
  }

  @Get('leaderboard')
  @ApiOperation({ summary: 'Get races / runners leaderboard ranking' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  async getLeaderboard(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ): Promise<any> {
    const data = await this.raceService.getLeaderboard(page, limit);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Leaderboard fetched successfully',
      data,
    };
  }

  @Get('my')
  @ApiOperation({ summary: 'Get all races created/published by the logged-in user' })
  async findMyRaces(@Req() req, @Query() query: RaceQueryDto): Promise<any> {
    const data = await this.raceService.findMyRaces(req.user.id, query);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'My published races fetched successfully',
      data,
    };
  }

  @Get('joined')
  @ApiOperation({ summary: 'Get all races joined/registered by the logged-in user' })
  async findJoinedRaces(@Req() req, @Query() query: RaceQueryDto): Promise<any> {
    const data = await this.raceService.findJoinedRaces(req.user.id, query);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Joined races fetched successfully',
      data,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single race details by ID' })
  @ApiParam({ name: 'id', description: 'Race ID' })
  async findOne(@Req() req, @Param('id') id: string): Promise<any> {
    const data = await this.raceService.findOne(id, req.user.id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Race details fetched successfully',
      data,
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a race (only creator)' })
  @ApiParam({ name: 'id', description: 'Race ID' })
  @ApiBody({ type: UpdateRaceDto })
  async update(
    @Req() req,
    @Param('id') id: string,
    @Body() updateRaceDto: UpdateRaceDto,
  ): Promise<any> {
    const data = await this.raceService.update(req.user.id, id, updateRaceDto);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Race updated successfully',
      data,
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a race (only creator)' })
  @ApiParam({ name: 'id', description: 'Race ID' })
  async remove(@Req() req, @Param('id') id: string): Promise<any> {
    const data = await this.raceService.remove(req.user.id, id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Race deleted successfully',
      data,
    };
  }

  @Post(':id/join')
  @ApiOperation({ summary: 'Register / Join a race' })
  @ApiParam({ name: 'id', description: 'Race ID' })
  async joinRace(@Req() req, @Param('id') id: string): Promise<any> {
    const data = await this.raceService.joinRace(req.user.id, id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Successfully registered for the race',
      data,
    };
  }

  @Post(':id/leave')
  @ApiOperation({ summary: 'Leave / Unregister from a race' })
  @ApiParam({ name: 'id', description: 'Race ID' })
  async leaveRace(@Req() req, @Param('id') id: string): Promise<any> {
    const data = await this.raceService.leaveRace(req.user.id, id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Successfully unregistered from the race',
      data,
    };
  }
}
