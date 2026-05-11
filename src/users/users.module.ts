import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User, UserSchema } from './entities/user.entity';
import { Chat, ChatSchema } from '../chat/entities/chat.entity';
import { Message, MessageSchema } from '../chat/entities/message.entity';
import { Match, MatchSchema } from '../matches/entities/match.entity';
import { RunInvite, RunInviteSchema } from '../matches/entities/run-invite.entity';
import { MailModule } from 'src/Mail/mail.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Chat.name, schema: ChatSchema },
      { name: Message.name, schema: MessageSchema },
      { name: Match.name, schema: MatchSchema },
      { name: RunInvite.name, schema: RunInviteSchema },
    ]),
    MailModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule { }
