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
import { GroupService } from './group.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { AddMembersDto } from './dto/add-members.dto';
import { CreateGroupRunDto } from './dto/create-group-run.dto';
import { RecordCoordinateDto } from '../community/dto/record-coordinate.dto';


@ApiTags('Group')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('group')
export class GroupController {
  constructor(private readonly groupService: GroupService) { }

  @Post()
  @ApiOperation({ summary: 'Create a new group with optional matched members' })
  @ApiBody({ type: CreateGroupDto })
  async create(@Req() req, @Body() body: CreateGroupDto) {
    const data = await this.groupService.create(req.user.id, body);
    return {
      statusCode: HttpStatus.CREATED,
      success: true,
      message: 'Group created successfully',
      data,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get groups by type (my, joined, all)' })
  @ApiQuery({ name: 'type', required: false, enum: ['my', 'joined', 'all'], description: 'Type of groups to retrieve' })
  async getGroups(@Req() req, @Query('type') type?: string) {
    let data;
    let message = 'Groups fetched successfully';

    if (type === 'my') {
      data = await this.groupService.findOwn(req.user.id);
      message = 'My groups fetched successfully';
    } else if (type === 'joined') {
      data = await this.groupService.findJoinedOthers(req.user.id);
      message = 'Other joined groups fetched successfully';
    } else {
      // Default to 'all' (unjoined other groups)
      data = await this.groupService.findAllExceptOwn(req.user.id);
      message = 'Unjoined groups fetched successfully';
    }

    return {
      statusCode: HttpStatus.OK,
      success: true,
      message,
      data,
    };
  }

  @Get('potential-members')
  @ApiOperation({ summary: 'Get a list of users matched with the current user who can be added to the group' })
  async getPotentialMembers(@Req() req) {
    const data = await this.groupService.getPotentialMembers(req.user.id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Potential group members (matches) fetched successfully',
      data,
    };
  }

  @Get('runs/feed')
  @ApiOperation({ summary: 'Get a feed of upcoming group runs for joined groups' })
  async getRunsFeed(@Req() req) {
    const data = await this.groupService.getRunsFeed(req.user.id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Group runs feed fetched successfully',
      data,
    };
  }

  @Get('runs/history')
  @ApiOperation({ summary: 'Get history of completed group runs user participated in' })
  async getRunsHistory(@Req() req) {
    const data = await this.groupService.getRunsHistory(req.user.id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Group runs history fetched successfully',
      data,
    };
  }

  @Post(':groupId/runs')
  @ApiOperation({ summary: 'Create a run in a specific group (members only)' })
  @ApiBody({ type: CreateGroupRunDto })
  async createRun(
    @Param('groupId') groupId: string,
    @Req() req,
    @Body() body: CreateGroupRunDto,
  ) {
    const data = await this.groupService.createRun(req.user.id, groupId, body);
    return {
      statusCode: HttpStatus.CREATED,
      success: true,
      message: 'Group run created successfully',
      data,
    };
  }

  @Post('runs/:runId/join')
  @ApiOperation({ summary: 'Join an upcoming group run' })
  async joinRun(@Param('runId') runId: string, @Req() req) {
    const data = await this.groupService.joinRun(req.user.id, runId);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Successfully joined the group run',
      data,
    };
  }

  @Post('runs/:runId/complete')
  @ApiOperation({ summary: 'Mark a group run as completed (creator only)' })
  async completeRun(@Param('runId') runId: string, @Req() req) {
    const data = await this.groupService.completeRun(req.user.id, runId);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Group run marked as completed successfully',
      data,
    };
  }

  @Post('runs/:runId/coordinates')
  @ApiOperation({ summary: 'Record a coordinate point for an ongoing group run' })
  @ApiBody({ type: RecordCoordinateDto })
  async recordCoordinate(
    @Param('runId') runId: string,
    @Req() req,
    @Body() body: RecordCoordinateDto,
  ) {
    const data = await this.groupService.recordRunCoordinate(req.user.id, runId, body);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Run coordinate recorded successfully',
      data,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a specific group' })
  async findOne(@Param('id') id: string) {
    const data = await this.groupService.findOne(id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Group details fetched successfully',
      data,
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update group details or members list (creator only)' })
  @ApiBody({ type: UpdateGroupDto })
  async update(@Param('id') id: string, @Req() req, @Body() body: UpdateGroupDto) {
    const data = await this.groupService.update(req.user.id, id, body);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Group updated successfully',
      data,
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a group (creator only)' })
  async remove(@Param('id') id: string, @Req() req) {
    const data = await this.groupService.delete(req.user.id, id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Group deleted successfully',
      data,
    };
  }

  @Post(':id/members')
  @ApiOperation({ summary: 'Add matched members to an existing group (creator only)' })
  @ApiBody({ type: AddMembersDto })
  async addMembers(@Param('id') id: string, @Req() req, @Body() body: AddMembersDto) {
    const data = await this.groupService.addMembers(req.user.id, id, body);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Members added successfully to the group',
      data,
    };
  }

  @Post(':id/leave')
  @ApiOperation({ summary: 'Leave a group (member only)' })
  async leave(@Param('id') id: string, @Req() req) {
    const data = await this.groupService.leave(req.user.id, id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Left group successfully',
      data,
    };
  }

}
