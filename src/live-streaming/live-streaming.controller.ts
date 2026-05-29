import { Controller, Get, Query, UseGuards, BadRequestException, Request, HttpStatus } from '@nestjs/common';
import { AgoraService } from './agora.service';
import { LiveStreamingService } from './live-streaming.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiExcludeEndpoint, ApiResponse } from '@nestjs/swagger';
import { MatchesLiveResponseDto } from './dto/matches-live-response.dto';

@ApiTags('Live Streaming')
@ApiBearerAuth()
@Controller('live-streaming')
export class LiveStreamingController {
    constructor(
        private readonly agoraService: AgoraService,
        private readonly liveStreamingService: LiveStreamingService,
    ) {}

    @ApiExcludeEndpoint()
    @UseGuards(JwtAuthGuard)
    @Get('token')
    async getToken(
        @Request() req: any,
        @Query('channelName') channelName: string,
        @Query('uid') uid?: string,
    ) {
        if (!channelName) {
            throw new BadRequestException('channelName is required');
        }

        // Default uid to 0 if not provided, or parse from string
        const userId = uid ? parseInt(uid, 10) : 0;
        
        if (isNaN(userId)) {
            throw new BadRequestException('uid must be a number');
        }

        const token = this.agoraService.generateRtcToken(channelName, userId);
        
        return {
            token,
            channelName,
            uid: userId,
        };
    }

    @UseGuards(JwtAuthGuard)
    @Get('matches-live')
    @ApiOperation({ summary: 'Get active live streams of matches/friends' })
    @ApiResponse({ 
        status: 200, 
        description: 'Returns active live rooms of current user matches', 
        type: MatchesLiveResponseDto 
    })
    async getMatchesLive(@Request() req: any): Promise<MatchesLiveResponseDto> {
        const userId = req.user._id || req.user.id || req.user.sub;
        if (!userId) {
            throw new BadRequestException('User ID not found in token');
        }

        const liveRooms = await this.liveStreamingService.getMatchesLiveRooms(userId.toString());
        
        const message = liveRooms.length > 0
            ? 'Active live streams of matches fetched successfully'
            : 'No active live streams found for your matches';

        return {
            statusCode: HttpStatus.OK,
            success: true,
            message,
            data: liveRooms,
        };
    }
}
