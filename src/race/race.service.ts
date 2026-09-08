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
import { Run, RunDocument } from '../runs/entities/run.entity';
import { CreateRaceDto } from './dto/create-race.dto';
import { UpdateRaceDto } from './dto/update-race.dto';
import { RaceQueryDto } from './dto/race-query.dto';
import { LeaderboardQueryDto } from './dto/leaderboard-query.dto';

@Injectable()
export class RaceService {
  constructor(
    @InjectModel(Race.name) private readonly raceModel: Model<RaceDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Run.name) private readonly runModel: Model<RunDocument>,
  ) { }

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

  async getLeaderboard(
    userId?: string,
    query?: LeaderboardQueryDto,
  ): Promise<any> {
    const rawTimeframe = query?.timeframe || 'weekly';
    const sortBy = query?.sortBy || 'points';
    const page = query?.page || 1;
    const limit = query?.limit || 20;

    // Normalize timeframe: weekly / this_week, all / all_time, monthly, yearly
    let timeframe: 'weekly' | 'monthly' | 'yearly' | 'all' = 'weekly';
    const normalized = rawTimeframe.toLowerCase().trim().replace('-', '_');
    if (['weekly'].includes(normalized)) {
      timeframe = 'weekly';
    } else if (['all'].includes(normalized)) {
      timeframe = 'all';
    } else if (['monthly'].includes(normalized)) {
      timeframe = 'monthly';
    } else if (['yearly'].includes(normalized)) {
      timeframe = 'yearly';
    }

    const now = new Date();
    let startDate: Date | null = null;

    if (timeframe === 'weekly') {
      const startOfWeek = new Date(now);
      const day = now.getDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday
      const diff = now.getDate() - (day === 0 ? 6 : day - 1); // Monday start
      startOfWeek.setDate(diff);
      startOfWeek.setHours(0, 0, 0, 0);
      startDate = startOfWeek;
    } else if (timeframe === 'monthly') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    } else if (timeframe === 'yearly') {
      startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    } // 'all' leaves startDate = null

    // Determine sorting criteria
    let sortField = 'points';
    if (sortBy === 'distance' || sortBy === 'total_miles') {
      sortField = 'total_miles';
    } else if (sortBy === 'runs') {
      sortField = 'totalRuns';
    }

    let rankedUsers: any[] = [];

    const matchFilter: any = { status: 'completed' };
    if (startDate) {
      matchFilter.$or = [
        { date: { $gte: startDate } },
        { createdAt: { $gte: startDate } },
      ];
    }

    // Aggregate completed runs for the selected period
    const runAgg = await this.runModel.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: '$userId',
          points: { $sum: '$pointsEarned' },
          total_miles: { $sum: '$distance' },
          totalRuns: { $sum: 1 },
          calories: { $sum: '$calories' },
          latestPace: { $last: '$pace' },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: '$user' },
      {
        $project: {
          _id: 1,
          points: 1,
          total_miles: { $round: ['$total_miles', 2] },
          totalRuns: 1,
          calories: { $round: ['$calories', 0] },
          latestPace: 1,
          full_name: '$user.full_name',
          display_name: '$user.display_name',
          first_name: '$user.first_name',
          last_name: '$user.last_name',
          image: '$user.image',
          running_level: '$user.running_level',
          average_pace: '$user.average_pace',
          userPoints: '$user.points',
          userTotalMiles: '$user.total_miles',
          streak: '$user.streak',
          badges: '$user.badges',
        },
      },
      {
        $sort: {
          [sortField]: -1,
          points: -1,
          total_miles: -1,
        },
      },
    ]);

    if (timeframe === 'all') {
      // For all-time, also merge users with profile data if they haven't logged runs or user table has higher stats
      const runUserIds = runAgg.map((r) => r._id.toString());
      const allUsers = await this.userModel
        .find({})
        .select(
          'full_name display_name first_name last_name image points total_miles streak badges running_level average_pace',
        )
        .lean();

      const userMap = new Map<string, any>();
      for (const u of allUsers) {
        userMap.set(u._id.toString(), u);
      }

      const combinedUsers: any[] = [];
      const visited = new Set<string>();

      for (const r of runAgg) {
        const uId = r._id.toString();
        visited.add(uId);
        const profile = userMap.get(uId);
        const points = Math.max(r.points || 0, profile?.points || 0);
        const total_miles = Math.max(r.total_miles || 0, profile?.total_miles || 0);
        combinedUsers.push({
          _id: r._id,
          full_name: r.full_name || profile?.full_name,
          display_name: r.display_name || profile?.display_name,
          first_name: r.first_name || profile?.first_name,
          last_name: r.last_name || profile?.last_name,
          image: r.image || profile?.image,
          points,
          total_miles: Math.round(total_miles * 100) / 100,
          distance: Math.round(total_miles * 100) / 100,
          totalRuns: r.totalRuns || 0,
          racesCount: r.totalRuns || 0,
          pace: r.latestPace || profile?.average_pace || '8:30/mi',
          calories: r.calories || 0,
          streak: profile?.streak || r.streak || 0,
          badges: profile?.badges || r.badges || [],
          running_level: profile?.running_level || r.running_level || 'Beginner',
        });
      }

      for (const u of allUsers) {
        const uId = u._id.toString();
        if (!visited.has(uId)) {
          combinedUsers.push({
            _id: u._id,
            full_name: u.full_name,
            display_name: u.display_name,
            first_name: u.first_name,
            last_name: u.last_name,
            image: u.image,
            points: u.points || 0,
            total_miles: u.total_miles || 0,
            distance: u.total_miles || 0,
            totalRuns: 0,
            racesCount: 0,
            pace: u.average_pace || '8:30/mi',
            calories: 0,
            streak: u.streak || 0,
            badges: u.badges || [],
            running_level: u.running_level || 'Beginner',
          });
        }
      }

      combinedUsers.sort((a, b) => {
        if (b[sortField] !== a[sortField]) {
          return (b[sortField] || 0) - (a[sortField] || 0);
        }
        if (b.points !== a.points) {
          return (b.points || 0) - (a.points || 0);
        }
        return (b.total_miles || 0) - (a.total_miles || 0);
      });

      rankedUsers = combinedUsers.map((user, index) => ({
        rank: index + 1,
        isCurrentUser: userId ? user._id?.toString() === userId.toString() : false,
        ...user,
      }));
    } else {
      rankedUsers = runAgg.map((user, index) => ({
        rank: index + 1,
        _id: user._id,
        isCurrentUser: userId ? user._id?.toString() === userId.toString() : false,
        full_name: user.full_name,
        display_name: user.display_name,
        first_name: user.first_name,
        last_name: user.last_name,
        image: user.image,
        points: user.points || 0,
        total_miles: user.total_miles || 0,
        distance: user.total_miles || 0,
        totalRuns: user.totalRuns || 0,
        racesCount: user.totalRuns || 0,
        pace: user.latestPace || user.average_pace || '8:30/mi',
        calories: user.calories || 0,
        streak: user.streak || 0,
        badges: user.badges || [],
        running_level: user.running_level || 'Beginner',
      }));
    }

    // Top 3 Podium Runners
    const top3 = rankedUsers.slice(0, 3);

    // Current Logged-in User Rank and Stats
    let currentUserRank: any = null;
    if (userId) {
      const userIndex = rankedUsers.findIndex(
        (u) => u._id?.toString() === userId.toString(),
      );

      if (userIndex !== -1) {
        currentUserRank = {
          ...rankedUsers[userIndex],
          isCurrentUser: true,
        };
      } else {
        const user = await this.userModel
          .findById(userId)
          .select(
            'full_name display_name first_name last_name image points total_miles streak badges running_level average_pace',
          )
          .lean();

        if (user) {
          currentUserRank = {
            rank: null,
            _id: user._id,
            isCurrentUser: true,
            full_name: user.full_name,
            display_name: user.display_name,
            first_name: user.first_name,
            last_name: user.last_name,
            image: user.image,
            points: timeframe === 'all' ? user.points || 0 : 0,
            userTotalPoints: user.points || 0,
            total_miles: timeframe === 'all' ? user.total_miles || 0 : 0,
            distance: timeframe === 'all' ? user.total_miles || 0 : 0,
            totalRuns: 0,
            racesCount: 0,
            pace: user.average_pace || '8:30/mi',
            calories: 0,
            streak: user.streak || 0,
            badges: user.badges || [],
            running_level: user.running_level || 'Beginner',
          };
        }
      }
    }

    const total = rankedUsers.length;
    const skip = (page - 1) * limit;
    const paginatedLeaderboard = rankedUsers.slice(skip, skip + limit);

    return {
      timeframe,
      sortBy,
      top3,
      currentUserRank,
      leaderboard: paginatedLeaderboard,
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
