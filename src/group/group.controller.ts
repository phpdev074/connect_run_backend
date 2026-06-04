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

  @Post(':id/join')
  @ApiOperation({ summary: 'Join a group' })
  async join(@Param('id') id: string, @Req() req) {
    const data = await this.groupService.join(req.user.id, id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Joined group successfully',
      data,
    };
  }
}
