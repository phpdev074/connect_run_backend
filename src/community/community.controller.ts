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
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiBody } from '@nestjs/swagger';
import { CommunityService } from './community.service';
import { CreateCommunityDto } from './dto/create-community.dto';
import { UpdateCommunityDto } from './dto/update-community.dto';
import { AddMembersDto } from './dto/add-members.dto';

@ApiTags('Community')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('community')
export class CommunityController {
  constructor(private readonly communityService: CommunityService) {}

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

  @Get('my')
  @ApiOperation({ summary: 'Get all communities created by the logged-in user' })
  async findOwn(@Req() req) {
    const data = await this.communityService.findOwn(req.user.id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'My communities fetched successfully',
      data,
    };
  }

  @Get('others')
  @ApiOperation({ summary: "Get all other users' communities (excluding own)" })
  async findOthers(@Req() req) {
    const data = await this.communityService.findAllExceptOwn(req.user.id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Other communities fetched successfully',
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
}
