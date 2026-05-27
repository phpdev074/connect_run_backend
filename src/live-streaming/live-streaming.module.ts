import { Module } from '@nestjs/common';
import { LiveStreamingService } from './live-streaming.service';
import { AgoraService } from './agora.service';
// import { LiveGateway } from './live.gateway';
import { ChatModule } from '../chat/chat.module';
import { MatchesModule } from '../matches/matches.module';
// import { FollowsModule } from '../follows/follows.module';
// import { NotificationModule } from '../notification/notification.module';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../users/entities/user.entity';
import { LiveStreamingController } from './live-streaming.controller';
import { NotificationsModule } from 'src/notifications/notifications.module';
import { LiveGateway } from './live.gateway';

@Module({
    imports: [
        ChatModule,
        MatchesModule,
        // FollowsModule,
        NotificationsModule,
        MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    ],
    controllers: [LiveStreamingController],
    providers: [LiveStreamingService, AgoraService, LiveGateway],
    exports: [LiveStreamingService, AgoraService, LiveGateway],
})
export class LiveStreamingModule { }
