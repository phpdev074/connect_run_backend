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
import { CommunityService } from './community.service';
import { CreateCommunityDto } from './dto/create-community.dto';
import { UpdateCommunityDto } from './dto/update-community.dto';
import { AddMembersDto } from './dto/add-members.dto';
import { CreateCommunityRunDto } from './dto/create-community-run.dto';
import { RecordCoordinateDto } from './dto/record-coordinate.dto';

@ApiTags('Community')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('community')
export class CommunityController {
  constructor(private readonly communityService: CommunityService) { }

  @Post()
  @ApiOperation({ summary: 'Create a new community with optional matched members' })
  @ApiBody({ type: CreateCommunityDto })
  async create(@Req() req, @Body() body: CreateCommunityDto) {
    const data = await this.communityService.create(req.user.id, body);
    return {
      statusCode: HttpStatus.CREATED,
      success: true,
      message: 'Community created successfully',
      data,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get communities by type (my, joined, all)' })
  @ApiQuery({ name: 'type', required: false, enum: ['my', 'joined', 'all'], description: 'Type of communities to retrieve' })
  async getCommunities(@Req() req, @Query('type') type?: string) {
    let data;
    let message = 'Communities fetched successfully';

    if (type === 'my') {
      data = await this.communityService.findOwn(req.user.id);
      message = 'My communities fetched successfully';
    } else if (type === 'joined') {
      data = await this.communityService.findJoinedOthers(req.user.id);
      message = 'Other joined communities fetched successfully';
    } else {
      // Default to 'all' (unjoined other communities)
      data = await this.communityService.findAllExceptOwn(req.user.id);
      message = 'Unjoined communities fetched successfully';
    }

    return {
      statusCode: HttpStatus.OK,
      success: true,
      message,
      data,
    };
  }

  @Get('potential-members')
  @ApiOperation({ summary: 'Get a list of users matched with the current user who can be added to the community' })
  async getPotentialMembers(@Req() req) {
    const data = await this.communityService.getPotentialMembers(req.user.id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Potential community members (matches) fetched successfully',
      data,
    };
  }

  @Get('runs/feed')
  @ApiOperation({ summary: 'Get a feed of upcoming community runs for joined communities' })
  async getRunsFeed(@Req() req) {
    const data = await this.communityService.getRunsFeed(req.user.id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Community runs feed fetched successfully',
      data,
    };
  }

  @Get('runs/history')
  @ApiOperation({ summary: 'Get history of completed community runs user participated in' })
  async getRunsHistory(@Req() req) {
    const data = await this.communityService.getRunsHistory(req.user.id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Community runs history fetched successfully',
      data,
    };
  }

  @Post(':communityId/runs')
  @ApiOperation({ summary: 'Create a run in a specific community (members only)' })
  @ApiBody({ type: CreateCommunityRunDto })
  async createRun(
    @Param('communityId') communityId: string,
    @Req() req,
    @Body() body: CreateCommunityRunDto,
  ) {
    const data = await this.communityService.createRun(req.user.id, communityId, body);
    return {
      statusCode: HttpStatus.CREATED,
      success: true,
      message: 'Community run created successfully',
      data,
    };
  }

  @Post('runs/:runId/join')
  @ApiOperation({ summary: 'Join an upcoming community run' })
  async joinRun(@Param('runId') runId: string, @Req() req) {
    const data = await this.communityService.joinRun(req.user.id, runId);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Successfully joined the community run',
      data,
    };
  }

  @Post('runs/:runId/complete')
  @ApiOperation({ summary: 'Mark a community run as completed (creator only)' })
  async completeRun(@Param('runId') runId: string, @Req() req) {
    const data = await this.communityService.completeRun(req.user.id, runId);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Community run marked as completed successfully',
      data,
    };
  }

  @Post('runs/:runId/coordinates')
  @ApiOperation({ summary: 'Record a coordinate point for an ongoing community run' })
  @ApiBody({ type: RecordCoordinateDto })
  async recordCoordinate(
    @Param('runId') runId: string,
    @Req() req,
    @Body() body: RecordCoordinateDto,
  ) {
    const data = await this.communityService.recordRunCoordinate(req.user.id, runId, body);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Run coordinate recorded successfully',
      data,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a specific community' })
  async findOne(@Param('id') id: string) {
    const data = await this.communityService.findOne(id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Community details fetched successfully',
      data,
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update community details or members list (creator only)' })
  @ApiBody({ type: UpdateCommunityDto })
  async update(@Param('id') id: string, @Req() req, @Body() body: UpdateCommunityDto) {
    const data = await this.communityService.update(req.user.id, id, body);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Community updated successfully',
      data,
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a community (creator only)' })
  async remove(@Param('id') id: string, @Req() req) {
    const data = await this.communityService.delete(req.user.id, id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Community deleted successfully',
      data,
    };
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'Add matched members to an existing community (creator only)' })
  @ApiBody({ type: AddMembersDto })
  async addMembers(@Param('id') id: string, @Req() req, @Body() body: AddMembersDto) {
    const data = await this.communityService.addMembers(req.user.id, id, body);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Members added successfully to the community',
      data,
    };
  }

  @Post(':id/leave')
  @ApiOperation({ summary: 'Leave a community (member only)' })
  async leave(@Param('id') id: string, @Req() req) {
    const data = await this.communityService.leave(req.user.id, id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Left community successfully',
      data,
    };
  }

  @Post(':id/join')
  @ApiOperation({ summary: 'Join a community' })
  async join(@Param('id') id: string, @Req() req) {
    const data = await this.communityService.join(req.user.id, id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Joined community successfully',
      data,
    };
  }
}
