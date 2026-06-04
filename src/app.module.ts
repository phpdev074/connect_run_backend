import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';

import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { UploadsModule } from './uploads/uploads.module';
import * as Joi from 'joi';
import { MissionsModule } from './missions/missions.module';
import { RunsModule } from './runs/runs.module';
import { MatchesModule } from './matches/matches.module';
import { ChatModule } from './chat/chat.module';
import { VirtualRoomModule } from './virtual-room/virtual-room.module';
import { ReelsModule } from './reels/reels.module';
import { RewardsModule } from './rewards/reward.module';
import { FirebaseModule } from './utils/firebase.module';
import { NotificationsModule } from './notifications/notifications.module';
import { LiveStreamingModule } from './live-streaming/live-streaming.module';
import { CommunityModule } from './community/community.module';
import { GroupModule } from './group/group.module';




@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        MONGO_URI: Joi.string().required(),
      }),
    }),

    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (config: ConfigService) => ({
        uri: config.get<string>('MONGO_URI'),
      }),
      inject: [ConfigService],
    }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
    AuthModule,
    UsersModule,
    UploadsModule,
    MissionsModule,
    RunsModule,
    MatchesModule,
    ChatModule,
    VirtualRoomModule,
    ReelsModule,
    RewardsModule,
    FirebaseModule,
    NotificationsModule,
    LiveStreamingModule,
    CommunityModule,
    GroupModule

  ],
})
export class AppModule { }
