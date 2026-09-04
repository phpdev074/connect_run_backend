import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Race, RaceDocument } from './entities/race.entity';
import { User, UserDocument } from '../users/entities/user.entity';
import { CreateRaceDto } from './dto/create-race.dto';
import { UpdateRaceDto } from './dto/update-race.dto';
import { RaceQueryDto } from './dto/race-query.dto';

@Injectable()
export class RaceService {
  constructor(
    @InjectModel(Race.name) private readonly raceModel: Model<RaceDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async create(userId: string, createRaceDto: CreateRaceDto): Promise<any> {
    const createdRace = new this.raceModel({
      ...createRaceDto,
      userId: new Types.ObjectId(userId),
      date: new Date(createRaceDto.date),
      participants: [],
      participantsCount: 0,
      tags: createRaceDto.tags || [],
      maxSpots: createRaceDto.maxSpots || 0,
      status: createRaceDto.status || 'upcoming',
      isActive: true,
    });

    const saved = await createdRace.save();
    return this.findOne(saved._id.toString(), userId);
  }

  async findAll(userId: string, query: RaceQueryDto): Promise<any> {
    const {
      search,
      location,
      city,
      raceType,
      distance,
      tag,
      tab,
      status,
      sortBy = 'date',
      sortOrder = 'asc',
      page = 1,
      limit = 10,
    } = query;

    const filter: any = { isActive: true };

    // 1. Tab filter
    if (tab === 'my-races' || tab === 'my') {
      filter.userId = new Types.ObjectId(userId);
    } else if (tab === 'joined') {
      filter.participants = new Types.ObjectId(userId);
    }

    // 2. City / Location search (Matches top search bar "Filter by city or location...")
    const locSearch = city || location;
    if (locSearch && locSearch.trim()) {
      const locRegex = new RegExp(locSearch.trim(), 'i');
      filter.$or = [
        { city: locRegex },
        { location: locRegex },
        { state: locRegex },
      ];
    }

    // 3. General Search keyword
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      const searchConditions: any[] = [
        { name: searchRegex },
        { organizer: searchRegex },
        { location: searchRegex },
        { city: searchRegex },
        { distance: searchRegex },
        { description: searchRegex },
        { tags: { $in: [searchRegex] } },
      ];

      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchConditions }];
        delete filter.$or;
      } else {
        filter.$or = searchConditions;
      }
    }

    // 4. Race Type Filter ("All Races", "In-Person", "Virtual")
    if (
      raceType &&
      raceType.trim() &&
      !['all', 'all races', 'any'].includes(raceType.toLowerCase())
    ) {
      filter.raceType = new RegExp(`^${raceType.trim()}$`, 'i');
    }

    // 5. Distance Filter ("Any Distance", "5K", "10K", "Half", "Full", "Other")
    if (
      distance &&
      distance.trim() &&
      !['any', 'any distance', 'all'].includes(distance.toLowerCase())
    ) {
      const dist = distance.trim().toLowerCase();
      if (dist === '5k') {
        filter.distance = { $regex: /(^|\s)5\s*k(m)?(\s|$)/i };
      } else if (dist === '10k') {
        filter.distance = { $regex: /(^|\s)10\s*k(m)?(\s|$)/i };
      } else if (dist === 'half' || dist === 'half marathon' || dist === '13.1') {
        filter.distance = { $regex: /half|13\.1/i };
      } else if (dist === 'full' || dist === 'full marathon' || dist === '26.2' || dist === 'marathon') {
        filter.distance = {
          $regex: /26\.2|full/i,
          $not: { $regex: /half/i },
        };
      } else if (dist === 'other') {
        filter.distance = {
          $not: { $regex: /5\s*k|10\s*k|half|13\.1|26\.2|marathon/i },
        };
      } else {
        filter.distance = new RegExp(distance.trim(), 'i');
      }
    }

    // 6. Tag filter
    if (tag && tag.trim()) {
      filter.tags = { $in: [new RegExp(tag.trim(), 'i')] };
    }

    // 7. Status filter
    if (status && status.trim() && status.toLowerCase() !== 'all') {
      filter.status = status.trim().toLowerCase();
    }

    // Sorting
    const sort: any = {};
    const order = sortOrder === 'desc' ? -1 : 1;
    if (sortBy === 'participantsCount' || sortBy === 'popularity') {
      sort.participantsCount = -1;
    } else if (sortBy === 'createdAt') {
      sort.createdAt = order;
    } else {
      sort.date = order;
      sort.createdAt = -1;
    }

    const skip = (page - 1) * limit;

    const [races, total] = await Promise.all([
      this.raceModel
        .find(filter)
        .populate('userId', 'full_name display_name first_name last_name image email')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      this.raceModel.countDocuments(filter),
    ]);

    const formatRace = (race: any) => {
      const participantsCount =
        race.participants?.length || race.participantsCount || 0;
      const maxSpots = race.maxSpots || 0;
      const spotsLeft = maxSpots > 0 ? Math.max(0, maxSpots - participantsCount) : null;
      const isJoined = userId
        ? race.participants?.some(
            (p: any) =>
              p?.toString() === userId || p?._id?.toString() === userId,
          )
        : false;

      return {
        ...race,
        isJoined,
        participantsCount,
        maxSpots,
        spotsLeft,
      };
    };

    return {
      races: races.map(formatRace),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async getLeaderboard(page: number = 1, limit: number = 20): Promise<any> {
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.userModel
        .find({})
        .select('full_name display_name first_name last_name image points total_miles streak badges running_level')
        .sort({ points: -1, total_miles: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      this.userModel.countDocuments({}),
    ]);

    const rankedUsers = users.map((user, index) => ({
      rank: skip + index + 1,
      ...user,
    }));

    return {
      leaderboard: rankedUsers,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findMyRaces(userId: string, query: RaceQueryDto): Promise<any> {
    return this.findAll(userId, { ...query, tab: 'my-races' });
  }

  async findJoinedRaces(userId: string, query: RaceQueryDto): Promise<any> {
    return this.findAll(userId, { ...query, tab: 'joined' });
  }

  async findOne(id: string, userId?: string): Promise<any> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid Race ID format');
    }

    const race: any = await this.raceModel
      .findOne({ _id: new Types.ObjectId(id), isActive: true })
      .populate('userId', 'full_name display_name first_name last_name image email')
      .populate('participants', 'full_name display_name first_name last_name image')
      .lean();

    if (!race) {
      throw new NotFoundException('Race not found');
    }

    const participantsCount =
      race.participants?.length || race.participantsCount || 0;
    const maxSpots = race.maxSpots || 0;
    const spotsLeft = maxSpots > 0 ? Math.max(0, maxSpots - participantsCount) : null;
    const isJoined = userId
      ? race.participants?.some(
          (p: any) =>
            p?.toString() === userId || p?._id?.toString() === userId,
        )
      : false;

    return {
      ...race,
      isJoined,
      participantsCount,
      maxSpots,
      spotsLeft,
    };
  }

  async update(userId: string, id: string, updateRaceDto: UpdateRaceDto): Promise<any> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid Race ID format');
    }

    const race = await this.raceModel.findById(id);
    if (!race || !race.isActive) {
      throw new NotFoundException('Race not found');
    }

    if (race.userId.toString() !== userId) {
      throw new ForbiddenException('You do not have permission to update this race');
    }

    const updateData: any = { ...updateRaceDto };
    if (updateRaceDto.date) {
      updateData.date = new Date(updateRaceDto.date);
    }

    return await this.raceModel
      .findByIdAndUpdate(id, { $set: updateData }, { new: true })
      .populate('userId', 'full_name display_name first_name last_name image email');
  }

  async remove(userId: string, id: string): Promise<any> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Invalid Race ID format');
    }

    const race = await this.raceModel.findById(id);
    if (!race || !race.isActive) {
      throw new NotFoundException('Race not found');
    }

    if (race.userId.toString() !== userId) {
      throw new ForbiddenException('You do not have permission to delete this race');
    }

    await this.raceModel.findByIdAndUpdate(id, { isActive: false });
    return { success: true, message: 'Race deleted successfully' };
  }

  async joinRace(userId: string, raceId: string): Promise<any> {
    if (!Types.ObjectId.isValid(raceId)) {
      throw new BadRequestException('Invalid Race ID format');
    }

    const userObjectId = new Types.ObjectId(userId);
    const race = await this.raceModel.findOne({ _id: raceId, isActive: true });

    if (!race) {
      throw new NotFoundException('Race not found');
    }

    const alreadyJoined = race.participants.some(
      (p) => p.toString() === userId,
    );

    if (alreadyJoined) {
      throw new BadRequestException('You have already registered for this race');
    }

    if (race.maxSpots && race.maxSpots > 0 && race.participantsCount >= race.maxSpots) {
      throw new BadRequestException('This race has reached its maximum capacity');
    }

    const updatedRace = await this.raceModel
      .findByIdAndUpdate(
        raceId,
        {
          $addToSet: { participants: userObjectId },
          $inc: { participantsCount: 1 },
        },
        { new: true },
      )
      .populate('userId', 'full_name display_name first_name last_name image email')
      .populate('participants', 'full_name display_name first_name last_name image');

    if (!updatedRace) {
      throw new NotFoundException('Race not found');
    }

    const maxSpots = updatedRace.maxSpots || 0;
    const spotsLeft =
      maxSpots > 0 ? Math.max(0, maxSpots - updatedRace.participantsCount) : null;

    return {
      message: 'Successfully registered for the race',
      race: {
        ...updatedRace.toObject(),
        isJoined: true,
        spotsLeft,
      },
    };
  }

  async leaveRace(userId: string, raceId: string): Promise<any> {
    if (!Types.ObjectId.isValid(raceId)) {
      throw new BadRequestException('Invalid Race ID format');
    }

    const userObjectId = new Types.ObjectId(userId);
    const race = await this.raceModel.findOne({ _id: raceId, isActive: true });

    if (!race) {
      throw new NotFoundException('Race not found');
    }

    const isRegistered = race.participants.some(
      (p) => p.toString() === userId,
    );

    if (!isRegistered) {
      throw new BadRequestException('You are not registered for this race');
    }

    const updatedRace = await this.raceModel
      .findByIdAndUpdate(
        raceId,
        {
          $pull: { participants: userObjectId },
          $inc: { participantsCount: -1 },
        },
        { new: true },
      )
      .populate('userId', 'full_name display_name first_name last_name image email')
      .populate('participants', 'full_name display_name first_name last_name image');

    if (!updatedRace) {
      throw new NotFoundException('Race not found');
    }

    const maxSpots = updatedRace.maxSpots || 0;
    const spotsLeft =
      maxSpots > 0 ? Math.max(0, maxSpots - updatedRace.participantsCount) : null;

    return {
      message: 'Successfully unregistered from the race',
      race: {
        ...updatedRace.toObject(),
        isJoined: false,
        spotsLeft,
      },
    };
  }
}
