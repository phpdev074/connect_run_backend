import { Module } from "@nestjs/common";
import { BlockService } from "./block.service";
import { BlockController } from "./block.controller";
import { Block, BlockSchema } from "./entities/block.entity";
import { User, UserSchema } from "src/users/entities/user.entity";
import { MongooseModule } from "@nestjs/mongoose";
import {
  Match,
  MatchSchema,
} from "../matches/entities/match.entity";
import {
  Notification,
  NotificationSchema,
} from "src/notifications/entities/notification.entity";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Block.name, schema: BlockSchema },
      { name: User.name, schema: UserSchema },
      { name: Match.name, schema: MatchSchema },
      { name: Notification.name, schema: NotificationSchema },
    ]),
  ],
  controllers: [BlockController],
  providers: [BlockService],
  exports: [BlockService],
})
export class BlockModule {}
