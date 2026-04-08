import { Controller, Get, Post, Body, Req, UseGuards, Query, HttpStatus } from '@nestjs/common';
import { MatchesService } from './matches.service';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiQuery, ApiBody } from '@nestjs/swagger';
import { LikeUserDto } from './dto/like-user.dto';

@ApiTags('Matches')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('matches')
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Get('discover')
  @ApiOperation({ summary: 'Discover new users based on mode' })
  @ApiQuery({ name: 'mode', required: false, enum: ['Dating', 'Buddy', 'Group'] })
  async discover(@Req() req, @Query('mode') mode: string) {
    const data = await this.matchesService.discover(req.user.id, mode);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Discoveries fetched successfully',
      data,
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
      message: 'Interaction recorded',
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
}
