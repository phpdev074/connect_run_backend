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
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiTags,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';

import { TeamsService } from './teams.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { InviteMembersDto } from './dto/team-actions.dto';
import { JoinTeamDto } from './dto/team-actions.dto';
import { UpdateTeamMilesDto } from './dto/team-actions.dto';
import { UpdateCaptainDto } from './dto/team-actions.dto';
import { AddChallengeDto } from './dto/team-actions.dto';

@ApiTags('Teams')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new team (owner becomes captain)' })
  @ApiBody({ type: CreateTeamDto })
  async create(@Req() req, @Body() body: CreateTeamDto) {
    const data = await this.teamsService.create(req.user.id, body);
    return {
      statusCode: HttpStatus.CREATED,
      success: true,
      message: 'Team created successfully',
      data,
    };
  }

  @Get()
  @ApiOperation({ summary: 'List teams (my, joined, all)' })
  @ApiQuery({ name: 'type', required: false, enum: ['my', 'joined', 'all'], description: 'Type of teams to retrieve' })
  async getTeams(@Req() req, @Query('type') type?: string) {
    let data;
    let message = 'Teams fetched successfully';

    if (type === 'my') {
      data = await this.teamsService.findOwned(req.user.id);
      message = 'Your teams fetched successfully';
    } else if (type === 'joined') {
      data = await this.teamsService.findJoined(req.user.id);
      message = 'Joined teams fetched successfully';
    } else {
      data = await this.teamsService.findAll(req.user.id);
      message = 'All teams fetched successfully';
    }

    return {
      statusCode: HttpStatus.OK,
      success: true,
      message,
      data,
    };
  }

  @Get('mine')
  @ApiOperation({ summary: 'Get the current user\'s owned or joined teams (combined)' })
  async getMyTeams(@Req() req) {
    const [owned, joined] = await Promise.all([
      this.teamsService.findOwned(req.user.id),
      this.teamsService.findJoined(req.user.id),
    ]);
    const merged = [...owned, ...joined];
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'My teams fetched successfully',
      data: merged,
    };
  }

  @Get('invitations')
  @ApiOperation({ summary: 'Get teams the current user has been invited to' })
  async getInvitations(@Req() req) {
    const data = await this.teamsService.getInvitations(req.user.id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Team invitations fetched successfully',
      data,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a specific team' })
  async findOne(@Param('id') id: string) {
    const data = await this.teamsService.findOne(id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Team details fetched successfully',
      data,
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a team (owner or captain only)' })
  @ApiBody({ type: UpdateTeamDto })
  async update(@Param('id') id: string, @Req() req, @Body() body: UpdateTeamDto) {
    const data = await this.teamsService.update(req.user.id, id, body);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Team updated successfully',
      data,
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a team (owner only)' })
  async remove(@Param('id') id: string, @Req() req) {
    const data = await this.teamsService.delete(req.user.id, id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Team deleted successfully',
      data,
    };
  }

  @Post(':id/invite')
  @ApiOperation({ summary: 'Invite users to join the team (owner or captain only)' })
  @ApiBody({ type: InviteMembersDto })
  async invite(@Param('id') id: string, @Req() req, @Body() body: InviteMembersDto) {
    const data = await this.teamsService.invite(req.user.id, id, body);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Members invited successfully',
      data,
    };
  }

  @Post(':id/accept')
  @ApiOperation({ summary: 'Accept an invite to join the team' })
  async acceptInvite(@Param('id') id: string, @Req() req) {
    const data = await this.teamsService.acceptInvite(req.user.id, id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Invite accepted successfully',
      data,
    };
  }

  @Post(':id/leave')
  @ApiOperation({ summary: 'Leave the team (members only)' })
  async leave(@Param('id') id: string, @Req() req) {
    const data = await this.teamsService.leave(req.user.id, id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Left team successfully',
      data,
    };
  }

  @Post(':id/miles')
  @ApiOperation({ summary: 'Add miles to the team\'s weekly total (member only)' })
  @ApiBody({ type: UpdateTeamMilesDto })
  async updateMiles(@Param('id') id: string, @Req() req, @Body() body: UpdateTeamMilesDto) {
    const data = await this.teamsService.updateMiles(req.user.id, id, body.miles);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Team miles updated successfully',
      data,
    };
  }

  @Post(':id/captain')
  @ApiOperation({ summary: 'Transfer captaincy to another member (owner only)' })
  @ApiBody({ type: UpdateCaptainDto })
  async transferCaptain(@Param('id') id: string, @Req() req, @Body() body: UpdateCaptainDto) {
    const data = await this.teamsService.transferCaptain(req.user.id, id, body);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Captain transferred successfully',
      data,
    };
  }

  @Post(':id/challenges')
  @ApiOperation({ summary: 'Add a challenge to the team (owner or captain only)' })
  @ApiBody({ type: AddChallengeDto })
  async addChallenge(@Param('id') id: string, @Req() req, @Body() body: AddChallengeDto) {
    const data = await this.teamsService.addChallenge(req.user.id, id, body);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Challenge added successfully',
      data,
    };
  }

  @Post('join-by-code')
  @ApiOperation({ summary: 'Join a team using a join code' })
  @ApiBody({ type: JoinTeamDto })
  async joinByCode(@Req() req, @Body() body: JoinTeamDto) {
    const data = await this.teamsService.joinByCode(req.user.id, body);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Joined team successfully',
      data,
    };
  }

  @Post(':id/join')
  @ApiOperation({ summary: 'Request to join a team' })
  async requestJoin(@Param('id') id: string, @Req() req) {
    const data = await this.teamsService.requestJoinTeam(req.user.id, id);
    return {
      statusCode: HttpStatus.OK,
      success: data.success,
      message: data.message,
    };
  }

  @Get(':id/join-requests')
  @ApiOperation({ summary: 'Get all join requests for a team (owner/captain only)' })
  async getJoinRequests(@Param('id') id: string, @Req() req) {
    const data = await this.teamsService.getJoinRequests(req.user.id, id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Join requests fetched successfully',
      data,
    };
  }

  @Post(':id/join-requests/:requestId')
  @ApiOperation({ summary: 'Approve or reject a join request (owner/captain only)' })
  @ApiBody({ schema: { type: 'object', properties: { status: { type: 'string', enum: ['approved', 'rejected'] } } } })
  async handleJoinRequest(
    @Param('id') id: string,
    @Param('requestId') requestId: string,
    @Body('status') status: string,
    @Req() req,
  ) {
    let data;
    if (status === 'approved') {
      data = await this.teamsService.approveJoinRequest(req.user.id, id, requestId);
    } else if (status === 'rejected') {
      data = await this.teamsService.rejectJoinRequest(req.user.id, id, requestId);
    } else {
      throw new BadRequestException('Invalid status. Use "approved" or "rejected".');
    }
    
    return {
      statusCode: HttpStatus.OK,
      success: data.success,
      message: data.message,
    };
  }
}
