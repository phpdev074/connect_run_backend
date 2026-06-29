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
import { CommentStoryDto } from './dto/comment-story.dto';
import { ReactStoryDto } from './dto/react-story.dto';

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

  @Post(':id/like')
  @ApiOperation({ summary: 'Toggle like/unlike on a story' })
  async toggleLikeStory(@Req() req, @Param('id') id: string) {
    const data = await this.storyService.toggleLikeStory(req.user.id, id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: data.liked ? 'Story liked successfully' : 'Story unliked successfully',
      data,
    };
  }

  @Post(':id/comment')
  @ApiOperation({ summary: 'Add a comment/reply to a story' })
  @ApiBody({ type: CommentStoryDto })
  async commentStory(@Req() req, @Param('id') id: string, @Body() dto: CommentStoryDto) {
    const data = await this.storyService.commentStory(req.user.id, id, dto.text);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Comment added successfully',
      data,
    };
  }

  @Post(':id/react')
  @ApiOperation({ summary: 'React to a story (maximum 1 reaction per user)' })
  @ApiBody({ type: ReactStoryDto })
  async reactStory(@Req() req, @Param('id') id: string, @Body() dto: ReactStoryDto) {
    const data = await this.storyService.reactStory(req.user.id, id, dto.reaction);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Reaction added/updated successfully',
      data,
    };
  }

  @Get(':id/likers')
  @ApiOperation({ summary: 'Get the list of users who liked the story' })
  async getStoryLikers(@Req() req, @Param('id') id: string) {
    const data = await this.storyService.getStoryLikers(req.user.id, id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Story likers fetched successfully',
      data,
    };
  }

  @Get(':id/comments-reactions')
  @ApiOperation({ summary: 'Get the list of comments and reactions for a story' })
  async getStoryCommentsAndReactions(@Req() req, @Param('id') id: string) {
    const data = await this.storyService.getStoryCommentsAndReactions(req.user.id, id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Story comments and reactions fetched successfully',
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
