import { Controller, Get, Post, Body, Req, UseGuards, Query, HttpStatus, Param } from '@nestjs/common';
import { MatchesService } from './matches.service';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiQuery, ApiBody } from '@nestjs/swagger';
import { LikeUserDto } from './dto/like-user.dto';
import { CreateRunInviteDto } from './dto/create-run-invite.dto';
import { RespondInviteDto } from './dto/respond-invite.dto';


@ApiTags('Matches')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('matches')
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) { }

  @Get('discover')
  @ApiOperation({ summary: 'Discover new users based on mode' })
  @ApiQuery({ name: 'mode', required: false, enum: ['Dating', 'Buddy', 'Group'] })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  async discover(
    @Req() req,
    @Query('mode') mode: string,
    @Query('search') search: string,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    const data = await this.matchesService.discover(
      req.user.id,
      mode,
      search,
      Number(page),
      Number(limit),
    );

    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Discoveries fetched successfully',
      ...data,
    };
  }

  @Post('like')
  @ApiOperation({ summary: 'Like a user to initiate a match' })
  @ApiBody({ type: LikeUserDto })
  async like(@Req() req, @Body() body: LikeUserDto) {
    const data = await this.matchesService.like(req.user.id, body.targetId);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Connection liked',
      data,
    };
  }

  @Post('super-like')
  @ApiOperation({ summary: 'Super like a user (costs 5 pts)' })
  @ApiBody({ type: LikeUserDto })
  async superLike(@Req() req, @Body() body: LikeUserDto) {
    const data = await this.matchesService.superLike(req.user.id, body.targetId);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'User super-liked',
      data,
    };
  }

  @Post('reject')
  @ApiOperation({ summary: 'Reject a user to exclude them from discovery' })
  @ApiBody({ type: LikeUserDto })
  async reject(@Req() req, @Body() body: LikeUserDto) {
    const data = await this.matchesService.reject(req.user.id, body.targetId);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'User rejected',
      data,
    };
  }

  @Get('pending-likes')
  @ApiOperation({ summary: 'Get list of users who liked me' })
  async getPendingLikes(@Req() req) {
    const data = await this.matchesService.getPendingLikes(req.user.id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Pending likes fetched successfully',
      data,
    };
  }

  @Get('list')
  @ApiOperation({ summary: 'Get list of all current matches' })
  async getMatches(@Req() req) {
    const data = await this.matchesService.getMatches(req.user.id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Matches fetched successfully',
      data,
    };
  }

  @Get('received-invites')
  @ApiOperation({ summary: 'Get list of run invites sent to the current user' })
  @ApiQuery({ name: 'filter', required: false, enum: ['all', 'active', 'new'], description: 'all = all invites, active = accepted, new = pending' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  async getReceivedInvites(
    @Req() req,
    @Query('filter') filter: 'all' | 'active' | 'new' = 'all',
    @Query('page') page = 1,
    @Query('limit') limit = 10,
  ) {
    const data = await this.matchesService.getReceivedInvites(
      req.user.id,
      filter,
      Number(page),
      Number(limit),
    );
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Received invites fetched successfully',
      ...data,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get details of a specific match' })
  async getMatchDetails(@Param('id') id: string) {
    const data = await this.matchesService.findMatchById(id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Match details fetched successfully',
      data,
    };
  }

  @Post(':id/detailed-invite')
  @ApiOperation({ summary: 'Send a detailed run invite (Virtual/In-Person) with date, time, and point requirements' })
  @ApiBody({ type: CreateRunInviteDto })
  async sendDetailedInvite(@Param('id') matchId: string, @Req() req, @Body() body: CreateRunInviteDto) {
    const data = await this.matchesService.sendDetailedInvite(matchId, req.user.id, body);
    return {
      statusCode: HttpStatus.CREATED,
      success: true,
      message: 'Run invite sent successfully',
      data,
    };
  }

  @Post('invite/:inviteId/respond')
  @ApiOperation({ summary: 'Respond to a run invite (accept/decline)' })
  @ApiBody({ type: RespondInviteDto })
  async respondInvite(@Param('inviteId') inviteId: string, @Req() req, @Body() body: RespondInviteDto) {
    const data = await this.matchesService.respondToInvite(inviteId, req.user.id, body.status);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: `Invite status updated to ${body.status}`,
      data,
    };
  }
}
