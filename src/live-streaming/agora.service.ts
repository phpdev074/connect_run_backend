import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RtcTokenBuilder, RtcRole } from 'agora-token';

@Injectable()
export class AgoraService {
    private readonly logger = new Logger(AgoraService.name);
    private readonly appId: string;
    private readonly appCertificate: string;

    constructor(private configService: ConfigService) {
        this.appId = this.configService.get<string>('AGORA_APP_ID') || '561b601d41b840febbf02607f41b3a53';
        this.appCertificate = this.configService.get<string>('AGORA_APP_CERTIFICATE') || '6284eca1d78046ecb641728b9e271072';
    }

    generateRtcToken(channelName: string, uid: number, role: number = RtcRole.PUBLISHER): string {
        const expirationTimeInSeconds = 3600; // 1 hour
        const currentTimestamp = Math.floor(Date.now() / 1000);
        const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

        try {
            const token = RtcTokenBuilder.buildTokenWithUid(
                this.appId,
                this.appCertificate,
                channelName,
                uid,
                role,
                privilegeExpiredTs,
                privilegeExpiredTs
            );
            return token;
        } catch (error) {
            this.logger.error('Failed to generate Agora token', error);
            throw error;
        }
    }
}
