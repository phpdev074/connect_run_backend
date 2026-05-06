import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { Chat, ChatSchema } from './entities/chat.entity';
import { Message, MessageSchema } from './entities/message.entity';
import { ChatGateway } from './chat.gateway';
import { MatchesModule } from '../matches/matches.module';
import { FirebaseModule } from '../utils/firebase.module';
import { FirebaseService } from '../utils/firebase.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Chat.name, schema: ChatSchema },
      { name: Message.name, schema: MessageSchema },
    ]),
    MatchesModule,
    FirebaseModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway, FirebaseService],
  exports: [ChatService],
})
export class ChatModule {}
