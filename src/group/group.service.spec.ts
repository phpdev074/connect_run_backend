import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { GroupService } from './group.service';
import { Group } from './entities/group.entity';
import { User } from '../users/entities/user.entity';
import { Match } from '../matches/entities/match.entity';
import { GroupRun } from './entities/group-run.entity';
import { GroupRunPath } from './entities/group-run-path.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';

describe('GroupService - recordRunCoordinate', () => {
  let service: GroupService;
  let mockGroupRunModel: any;
  let mockGroupRunPathModel: any;

  beforeEach(async () => {
    mockGroupRunModel = {
      findById: jest.fn(),
    };
    mockGroupRunPathModel = {
      findOne: jest.fn(),
      create: jest.fn(),
      findOneAndUpdate: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GroupService,
        {
          provide: getModelToken(Group.name),
          useValue: {},
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
          provide: getModelToken(GroupRun.name),
          useValue: mockGroupRunModel,
        },
        {
          provide: getModelToken(GroupRunPath.name),
          useValue: mockGroupRunPathModel,
        },
        {
          provide: NotificationsService,
          useValue: {
            sendAndSave: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<GroupService>(GroupService);
  });

  it('should throw NotFoundException if group run is not found', async () => {
    mockGroupRunModel.findById.mockResolvedValue(null);

    await expect(
      service.recordRunCoordinate('user123', 'run123', { latitude: 10, longitude: 20 }),
    ).rejects.toThrow(NotFoundException);
  });

  it('should throw ForbiddenException if user is not creator or participant', async () => {
    const mockRun = {
      _id: new Types.ObjectId(),
      createdBy: new Types.ObjectId(),
      participants: [new Types.ObjectId()],
    };
    mockGroupRunModel.findById.mockResolvedValue(mockRun);

    await expect(
      service.recordRunCoordinate('user123', mockRun._id.toString(), { latitude: 10, longitude: 20 }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('should create a new path if path does not exist', async () => {
    const userId = new Types.ObjectId();
    const mockRun = {
      _id: new Types.ObjectId(),
      createdBy: userId,
      participants: [userId],
      pathId: null,
      save: jest.fn().mockResolvedValue(true),
    };
    mockGroupRunModel.findById.mockResolvedValue(mockRun);
    mockGroupRunPathModel.findOne.mockResolvedValue(null);

    const mockPath = {
      _id: new Types.ObjectId(),
      groupRunId: mockRun._id,
      gpsTrack: [{ latitude: 10, longitude: 20 }],
    };
    mockGroupRunPathModel.create.mockResolvedValue(mockPath);

    const result = await service.recordRunCoordinate(userId.toString(), mockRun._id.toString(), {
      latitude: 10,
      longitude: 20,
    });

    expect(mockGroupRunPathModel.findOne).toHaveBeenCalledWith({ groupRunId: mockRun._id });
    expect(mockGroupRunPathModel.create).toHaveBeenCalledWith({
      groupRunId: mockRun._id,
      gpsTrack: [{ latitude: 10, longitude: 20 }],
    });
    expect(mockRun.pathId).toEqual(mockPath._id);
    expect(mockRun.save).toHaveBeenCalled();
    expect(result).toEqual(mockPath);
  });

  it('should append coordinate to existing path if it exists', async () => {
    const userId = new Types.ObjectId();
    const mockRun = {
      _id: new Types.ObjectId(),
      createdBy: userId,
      participants: [userId],
      pathId: new Types.ObjectId(),
    };
    mockGroupRunModel.findById.mockResolvedValue(mockRun);

    const mockPath = {
      _id: mockRun.pathId,
      groupRunId: mockRun._id,
      gpsTrack: [
        { latitude: 5, longitude: 5 },
        { latitude: 10, longitude: 20 },
      ],
    };
    mockGroupRunPathModel.findOne.mockResolvedValue(mockPath);
    mockGroupRunPathModel.findOneAndUpdate.mockResolvedValue(mockPath);

    const result = await service.recordRunCoordinate(userId.toString(), mockRun._id.toString(), {
      latitude: 10,
      longitude: 20,
    });

    expect(mockGroupRunPathModel.findOne).toHaveBeenCalledWith({ groupRunId: mockRun._id });
    expect(mockGroupRunPathModel.findOneAndUpdate).toHaveBeenCalledWith(
      { groupRunId: mockRun._id },
      { $push: { gpsTrack: { latitude: 10, longitude: 20 } } },
      { new: true },
    );
    expect(result).toEqual(mockPath);
  });
});
