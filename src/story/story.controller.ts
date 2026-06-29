import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  UseGuards,
  Patch,
  Delete,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiBody } from '@nestjs/swagger';
import { StoryService } from './story.service';
import { CreateStoryDto } from './dto/create-story.dto';
import { UpdateStoryDto } from './dto/update-story.dto';
import { StoryQueryDto } from './dto/story-query.dto';

@ApiTags('Stories')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('story')
export class StoryController {
  constructor(private readonly storyService: StoryService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new story' })
  @ApiBody({ type: CreateStoryDto })
  async create(@Req() req, @Body() createStoryDto: CreateStoryDto) {
    const data = await this.storyService.create(req.user.id, createStoryDto);
    return {
      statusCode: HttpStatus.CREATED,
      success: true,
      message: 'Story created successfully',
      data,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get active stories feed (grouped by user, paginated)' })
  async findAllFeed(@Req() req, @Query() query: StoryQueryDto) {
    const data = await this.storyService.findAllFeed(req.user.id, query);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Stories feed fetched successfully',
      data,
    };
  }

  @Get('my')
  @ApiOperation({ summary: 'Get active stories of the logged-in user with viewer list (paginated)' })
  async findMyActiveStories(@Req() req, @Query() query: StoryQueryDto) {
    const data = await this.storyService.findMyActiveStories(req.user.id, query);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'My active stories fetched successfully',
      data,
    };
  }

  @Get('history')
  @ApiOperation({ summary: 'Get expired/past stories of the logged-in user (paginated)' })
  async findMyHistory(@Req() req, @Query() query: StoryQueryDto) {
    const data = await this.storyService.findMyHistory(req.user.id, query);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'My story history fetched successfully',
      data,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single story details' })
  async findOne(@Req() req, @Param('id') id: string) {
    const data = await this.storyService.findOne(id, req.user.id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Story details fetched successfully',
      data,
    };
  }

  @Post(':id/watch')
  @ApiOperation({ summary: 'Mark a story as watched/viewed by the current user' })
  async watchStory(@Req() req, @Param('id') id: string) {
    const data = await this.storyService.watchStory(req.user.id, id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Story marked as watched successfully',
      data,
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a story' })
  @ApiBody({ type: UpdateStoryDto })
  async update(
    @Param('id') id: string,
    @Req() req,
    @Body() updateStoryDto: UpdateStoryDto,
  ) {
    const data = await this.storyService.update(req.user.id, id, updateStoryDto);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Story updated successfully',
      data,
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a story (soft delete)' })
  async remove(@Param('id') id: string, @Req() req) {
    const data = await this.storyService.remove(req.user.id, id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Story deleted successfully',
      data,
    };
  }
}
