import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { User, UserDocument } from './entities/user.entity';
import { Chat, ChatDocument } from '../chat/entities/chat.entity';
import { Message, MessageDocument } from '../chat/entities/message.entity';
import { Match, MatchDocument } from '../matches/entities/match.entity';
import { RunInvite, RunInviteDocument } from '../matches/entities/run-invite.entity';
import { Types, Model, Connection } from 'mongoose';
import { ChangePasswordDto } from './dto/change-password.dto';
import * as bcrypt from 'bcrypt';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UserSearchDto } from './dto/user-search.dto';
import { MailService } from 'src/Mail/mail.service';
import { buildForgotPasswordEmail } from 'src/Mail/templates/forgot-password.template';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Chat.name) private readonly chatModel: Model<ChatDocument>,
    @InjectModel(Message.name) private readonly messageModel: Model<MessageDocument>,
    @InjectModel(Match.name) private readonly matchModel: Model<MatchDocument>,
    @InjectModel(RunInvite.name) private readonly runInviteModel: Model<RunInviteDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly mailService: MailService,
  ) { }

  async create(data: any) {
    return this.userModel.create(data);
  }

  async findByEmail(email: string) {
    return this.userModel.findOne({ email });
  }

  async findByEmailWithPassword(email: string) {
    return this.userModel.findOne({ email }).select('+password');
  }

  async findByVerificationToken(token: string) {
    return this.userModel.findOne({ emailVerificationToken: token });
  }

  async findById(id: string) {
    return this.userModel.findById(id).select('-password');
  }

  async findAll(query: UserSearchDto) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter: any = {};

    // 🔹 Search filter
    if (query.search) {
      filter.$or = [
        { first_name: { $regex: query.search, $options: 'i' } },
        { last_name: { $regex: query.search, $options: 'i' } },
        { display_name: { $regex: query.search, $options: 'i' } },
        { email: { $regex: query.search, $options: 'i' } },
        { phone: { $regex: query.search, $options: 'i' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.userModel
        .find(filter)
        .select('-password -rowPassword -resetOtp -resetOtpExpire')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      this.userModel.countDocuments(filter),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }


  findOne(id: string) {
    return this.userModel.findById(id);
  }

  update(id: string, updateUserDto: any) {
    return this.userModel.findByIdAndUpdate(id, updateUserDto, { new: true }).select('-password');
  }

  async findByPhone(phone: string, countryCode: string) {
    return this.userModel.findOne({ phone, countryCode });
  }

  async remove(id: string) {
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const userObjectId = new Types.ObjectId(id);

      // 1. Fetch matches and chats in parallel to get their IDs
      const [matches, chats] = await Promise.all([
        this.matchModel.find({ users: userObjectId }).session(session).select('_id'),
        this.chatModel.find({ participants: userObjectId }).session(session).select('_id'),
      ]);

      const matchIds = matches.map((m) => m._id);
      const chatIds = chats.map((c) => c._id);

      // 2. Perform all clean-up deletions in parallel within the transaction
      await Promise.all([
        // Clean up Run Invites
        this.runInviteModel.deleteMany(
          {
            $or: [
              { matchId: { $in: matchIds } },
              { senderId: userObjectId },
              { receiverId: userObjectId },
            ],
          },
          { session },
        ),
        // Clean up Matches
        this.matchModel.deleteMany({ _id: { $in: matchIds } }, { session }),
        // Clean up Messages (in those chats or sent by user)
        this.messageModel.deleteMany(
          {
            $or: [{ chatId: { $in: chatIds } }, { senderId: userObjectId }],
          },
          { session },
        ),
        // Clean up Chats
        this.chatModel.deleteMany({ _id: { $in: chatIds } }, { session }),
        // Finally delete the user
        this.userModel.findByIdAndDelete(id, { session }),
      ]);

      await session.commitTransaction();
      return { success: true };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const match = await bcrypt.compare(dto.oldPassword, user.password);
    if (!match) throw new BadRequestException('Old password is incorrect');

    const hashed = await bcrypt.hash(dto.newPassword, 10);

    user.password = hashed;
    await user.save();

    return { message: 'Password changed successfully' };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const user = await this.userModel.findOne({
      email: dto.email,
      resetOtp: dto.otp,
      resetOtpExpire: { $gt: Date.now() },
    });

    if (!user) throw new BadRequestException('Invalid or expired OTP');

    return { message: 'OTP verified' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.userModel.findOne({ email: dto.email });
    if (!user) throw new BadRequestException('User not found');

    const hashed = await bcrypt.hash(dto.newPassword, 10);

    user.password = hashed;
    user.resetOtp = null;
    user.resetOtpExpire = null;

    await user.save();

    return { message: 'Password reset successful' };
  }

  findByPin(pin: string) {
    return this.userModel.findOne({ pin });
  }

  async updateOnlineStatus(userId: string, isOnline: boolean) {
    return this.userModel.findByIdAndUpdate(
      userId,
      { isOnline, lastSeen: new Date() },
      { new: true }
    );
  }
}
