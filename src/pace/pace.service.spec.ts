import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { PaceService } from './pace.service';
import { Pace } from './entities/pace.entity';
import { User } from '../users/entities/user.entity';
import { Match } from '../matches/entities/match.entity';
import { PaceRunPath } from './entities/pace-run-path.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { RewardsService } from '../rewards/rewards.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';

describe('PaceService - recordRunCoordinate', () => {
  let service: PaceService;
  let mockPaceModel: any;
  let mockPaceRunPathModel: any;

  beforeEach(async () => {
    mockPaceModel = {
      findById: jest.fn(),
    };
    mockPaceRunPathModel = {
      findOne: jest.fn(),
      create: jest.fn(),
      findOneAndUpdate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaceService,
        {
          provide: getModelToken(Pace.name),
          useValue: mockPaceModel,
        },
        {
          provide: getModelToken(User.name),
          useValue: {},
        },
        {
          provide: getModelToken(Match.name),
          useValue: {},
        },
        {
          provide: getModelToken(PaceRunPath.name),
          useValue: mockPaceRunPathModel,
        },
        {
          provide: NotificationsService,
          useValue: {
            sendAndSave: jest.fn(),
          },
        },
        {
          provide: RewardsService,
          useValue: {
            redeemPoints: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PaceService>(PaceService);
  });

  it('should throw NotFoundException if pace run is not found', async () => {
    mockPaceModel.findById.mockResolvedValue(null);

    await expect(
      service.recordRunCoordinate('user123', 'run123', { latitude: 10, longitude: 20 }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw ForbiddenException if user is not host or member', async () => {
    const mockPace = {
      _id: new Types.ObjectId(),
      createdBy: new Types.ObjectId(),
      members: [new Types.ObjectId()],
    };
    mockPaceModel.findById.mockResolvedValue(mockPace);

    await expect(
      service.recordRunCoordinate('user123', mockPace._id.toString(), { latitude: 10, longitude: 20 }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should create a new path if path does not exist', async () => {
    const userId = new Types.ObjectId();
    const mockPace = {
      _id: new Types.ObjectId(),
      createdBy: userId,
      members: [userId],
      pathId: null,
      save: jest.fn().mockResolvedValue(true),
    };
    mockPaceModel.findById.mockResolvedValue(mockPace);
    mockPaceRunPathModel.findOne.mockResolvedValue(null);

    const mockPath = {
      _id: new Types.ObjectId(),
      paceId: mockPace._id,
      gpsTrack: [{ latitude: 10, longitude: 20 }],
    };
    mockPaceRunPathModel.create.mockResolvedValue(mockPath);

    const result = await service.recordRunCoordinate(userId.toString(), mockPace._id.toString(), {
      latitude: 10,
      longitude: 20,
    });

    expect(mockPaceRunPathModel.findOne).toHaveBeenCalledWith({ paceId: mockPace._id });
    expect(mockPaceRunPathModel.create).toHaveBeenCalledWith({
      paceId: mockPace._id,
      gpsTrack: [{ latitude: 10, longitude: 20 }],
    });
    expect(mockPace.pathId).toEqual(mockPath._id);
    expect(mockPace.save).toHaveBeenCalled();
    expect(result).toEqual(mockPath);
  });

  it('should append coordinate to existing path if it exists', async () => {
    const userId = new Types.ObjectId();
    const mockPace = {
      _id: new Types.ObjectId(),
      createdBy: userId,
      members: [userId],
      pathId: new Types.ObjectId(),
    };
    mockPaceModel.findById.mockResolvedValue(mockPace);

    const mockPath = {
      _id: mockPace.pathId,
      paceId: mockPace._id,
      gpsTrack: [
        { latitude: 5, longitude: 5 },
        { latitude: 10, longitude: 20 },
      ],
    };
    mockPaceRunPathModel.findOne.mockResolvedValue(mockPath);
    mockPaceRunPathModel.findOneAndUpdate.mockResolvedValue(mockPath);

    const result = await service.recordRunCoordinate(userId.toString(), mockPace._id.toString(), {
      latitude: 10,
      longitude: 20,
    });

    expect(mockPaceRunPathModel.findOne).toHaveBeenCalledWith({ paceId: mockPace._id });
    expect(mockPaceRunPathModel.findOneAndUpdate).toHaveBeenCalledWith(
      { paceId: mockPace._id },
      { $push: { gpsTrack: { latitude: 10, longitude: 20 } } },
      { new: true },
    );
    expect(result).toEqual(mockPath);
  });
});
