import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { Chat, ChatSchema } from './entities/chat.entity';
import { Message, MessageSchema } from './entities/message.entity';
import { ChatGateway } from './chat.gateway';
import { MatchesModule } from '../matches/matches.module';
import { FirebaseModule } from '../utils/firebase.module';
import { FirebaseService } from '../utils/firebase.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Chat.name, schema: ChatSchema },
      { name: Message.name, schema: MessageSchema },
    ]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'supersecretkey',
      signOptions: { expiresIn: '30d' },
    }),
    MatchesModule,
    FirebaseModule,
    UsersModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway, FirebaseService],
  exports: [ChatService],
})
export class ChatModule {}
