import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  UseGuards,
  Patch,
  Param,
  Delete,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiBody, ApiQuery } from '@nestjs/swagger';
import { PaceService } from './pace.service';
import { CreatePaceDto } from './dto/create-pace.dto';
import { UpdatePaceDto } from './dto/update-pace.dto';
import { AddMembersDto } from './dto/add-members.dto';
import { RecordCoordinateDto } from '../community/dto/record-coordinate.dto';


@ApiTags('Pace')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('pace')
export class PaceController {
  constructor(private readonly paceService: PaceService) { }

  @Post()
  @ApiOperation({ summary: 'Host/create a new Pace run' })
  @ApiBody({ type: CreatePaceDto })
  async create(@Req() req, @Body() body: CreatePaceDto) {
    const data = await this.paceService.create(req.user.id, body);
    return {
      statusCode: HttpStatus.CREATED,
      success: true,
      message: 'Pace created successfully',
      data,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get Paces by type (my, joined, all)' })
  @ApiQuery({ name: 'type', required: false, enum: ['my', 'joined', 'all'], description: 'Type of Paces to retrieve' })
  async getPaces(@Req() req, @Query('type') type?: string) {
    let data;
    let message = 'Paces fetched successfully';

    if (type === 'my') {
      data = await this.paceService.findOwn(req.user.id);
      message = 'My hosted Paces fetched successfully';
    } else if (type === 'joined') {
      data = await this.paceService.findJoinedOthers(req.user.id);
      message = 'Joined Paces fetched successfully';
    } else {
      data = await this.paceService.findAllExceptOwn(req.user.id);
      message = 'Available Paces fetched successfully';
    }

    return {
      statusCode: HttpStatus.OK,
      success: true,
      message,
      data,
    };
  }

  @Get('potential-members')
  @ApiOperation({ summary: 'Get a list of matched users who can be added to the Pace' })
  async getPotentialMembers(@Req() req) {
    const data = await this.paceService.getPotentialMembers(req.user.id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Potential Pace members (matches) fetched successfully',
      data,
    };
  }

  @Get('feed')
  @ApiOperation({ summary: 'Get a feed of upcoming Pace runs available to join' })
  async getRunsFeed(@Req() req) {
    const data = await this.paceService.getFeed(req.user.id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Pace feed fetched successfully',
      data,
    };
  }

  @Get('history')
  @ApiOperation({ summary: 'Get history of completed Pace runs user participated in' })
  async getRunsHistory(@Req() req) {
    const data = await this.paceService.getHistory(req.user.id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Pace history fetched successfully',
      data,
    };
  }

  @Post(':id/join')
  @ApiOperation({ summary: 'Join a Pace run by paying its joining fee' })
  async join(@Param('id') id: string, @Req() req) {
    const data = await this.paceService.join(req.user.id, id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Joined Pace successfully',
      data,
    };
  }

  @Post(':id/complete')
  @ApiOperation({ summary: 'Mark a Pace run as completed (host only)' })
  async completeRun(@Param('id') id: string, @Req() req) {
    const data = await this.paceService.complete(req.user.id, id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Pace marked as completed successfully',
      data,
    };
  }

  @Post('runs/:runId/coordinates')
  @ApiOperation({ summary: 'Record a coordinate point for an ongoing Pace run' })
  @ApiBody({ type: RecordCoordinateDto })
  async recordCoordinate(
    @Param('runId') runId: string,
    @Req() req,
    @Body() body: RecordCoordinateDto,
  ) {
    const data = await this.paceService.recordRunCoordinate(req.user.id, runId, body);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Run coordinate recorded successfully',
      data,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a specific Pace run' })
  async findOne(@Param('id') id: string) {
    const data = await this.paceService.findOne(id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Pace details fetched successfully',
      data,
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update Pace details or members list (host only)' })
  @ApiBody({ type: UpdatePaceDto })
  async update(@Param('id') id: string, @Req() req, @Body() body: UpdatePaceDto) {
    const data = await this.paceService.update(req.user.id, id, body);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Pace updated successfully',
      data,
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Cancel/Delete a Pace run (host only)' })
  async remove(@Param('id') id: string, @Req() req) {
    const data = await this.paceService.delete(req.user.id, id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Pace deleted successfully',
      data,
    };
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'Add matched members to an existing Pace (host only)' })
  @ApiBody({ type: AddMembersDto })
  async addMembers(@Param('id') id: string, @Req() req, @Body() body: AddMembersDto) {
    const data = await this.paceService.addMembers(req.user.id, id, body);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Members added successfully to the Pace',
      data,
    };
  }

  @Post(':id/leave')
  @ApiOperation({ summary: 'Leave a Pace run (member only)' })
  async leave(@Param('id') id: string, @Req() req) {
    const data = await this.paceService.leave(req.user.id, id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Left Pace successfully',
      data,
    };
  }
}
