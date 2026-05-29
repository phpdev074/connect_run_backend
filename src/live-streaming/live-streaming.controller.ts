import { Controller, Get, Query, UseGuards, BadRequestException, Request } from '@nestjs/common';
import { AgoraService } from './agora.service';
import { LiveStreamingService } from './live-streaming.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@Controller('live-streaming')
export class LiveStreamingController {
    constructor(
        private readonly agoraService: AgoraService,
        private readonly liveStreamingService: LiveStreamingService,
    ) {}

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
    async getMatchesLive(@Request() req: any) {
        const userId = req.user._id || req.user.id || req.user.sub;
        if (!userId) {
            throw new BadRequestException('User ID not found in token');
        }

        const liveRooms = await this.liveStreamingService.getMatchesLiveRooms(userId.toString());
        
        return {
            success: true,
            data: liveRooms,
        };
    }
}
