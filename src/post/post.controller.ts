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
import { PostService } from './post.service';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { PostQueryDto } from './dto/post-query.dto';
import { CreateReportDto } from './dto/create-report.dto';

@ApiTags('Posts')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('post')
export class PostController {
  constructor(private readonly postService: PostService) { }

  @Post()
  @ApiOperation({ summary: 'Create a new post' })
  @ApiBody({ type: CreatePostDto })
  async create(@Req() req, @Body() createPostDto: CreatePostDto) {
    const data = await this.postService.create(req.user.id, createPostDto);
    return {
      statusCode: HttpStatus.CREATED,
      success: true,
      message: 'Post created successfully',
      data,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all active posts' })
  async findAll(@Req() req, @Query() query: PostQueryDto) {
    const data = await this.postService.findAll(req.user.id, query);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Posts fetched successfully',
      data,
    };
  }

  @Get('my')
  @ApiOperation({ summary: 'Get active posts of the logged-in user' })
  async findMyPosts(@Req() req, @Query() query: PostQueryDto) {
    const data = await this.postService.findByUserId(req.user.id, req.user.id, query);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'My posts fetched successfully',
      data,
    };
  }

  @Get('tagged')
  @ApiOperation({ summary: 'Get active posts in which the logged-in user is tagged' })
  async findTaggedPosts(@Req() req, @Query() query: PostQueryDto) {
    const data = await this.postService.findTaggedPosts(req.user.id, query);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Tagged posts fetched successfully',
      data,
    };
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get active posts of a specific user' })
  async findByUserId(
    @Req() req,
    @Param('userId') userId: string,
    @Query() query: PostQueryDto,
  ) {
    const data = await this.postService.findByUserId(userId, req.user.id, query);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'User posts fetched successfully',
      data,
    };
  }

  @Get('reports')
  @ApiOperation({ summary: 'Get list of reported posts with nested reporter details' })
  async getReportedPosts() {
    const data = await this.postService.getReportedPosts();
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Reported posts fetched successfully',
      data,
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single post details' })
  async findOne(@Req() req, @Param('id') id: string) {
    const data = await this.postService.findOne(id, req.user.id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Post details fetched successfully',
      data,
    };
  }

  @Get(':id/likers')
  @ApiOperation({ summary: 'Get list of users who liked the post' })
  async getLikers(@Param('id') id: string) {
    const data = await this.postService.getPostLikers(id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Likers fetched successfully',
      data,
    };
  }

  @Get(':id/commenters')
  @ApiOperation({ summary: 'Get list of unique users who commented or replied on the post' })
  async getCommenters(@Param('id') id: string) {
    const data = await this.postService.getPostCommenters(id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Commenters fetched successfully',
      data,
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a post' })
  @ApiBody({ type: UpdatePostDto })
  async update(
    @Param('id') id: string,
    @Req() req,
    @Body() updatePostDto: UpdatePostDto,
  ) {
    const data = await this.postService.update(req.user.id, id, updatePostDto);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Post updated successfully',
      data,
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a post (hard delete)' })
  async remove(@Param('id') id: string, @Req() req) {
    const data = await this.postService.remove(req.user.id, id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Post deleted successfully',
      data,
    };
  }

  @Post(':id/like')
  @ApiOperation({ summary: 'Like/Unlike a post' })
  async toggleLike(@Req() req, @Param('id') id: string) {
    const { liked } = await this.postService.toggleLike(req.user.id, id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: liked ? 'Post liked successfully' : 'Post unliked successfully',
      data: { liked },
    };
  }

  @Post(':id/watch')
  @ApiOperation({ summary: 'Increment the watch count of a post' })
  async incrementWatchCount(@Param('id') id: string) {
    const data = await this.postService.incrementWatchCount(id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Watch count incremented successfully',
      data,
    };
  }

  @Post(':id/report')
  @ApiOperation({ summary: 'Report a post' })
  @ApiBody({ type: CreateReportDto })
  async reportPost(
    @Req() req,
    @Param('id') id: string,
    @Body() createReportDto: CreateReportDto,
  ) {
    const data = await this.postService.reportPost(req.user.id, id, createReportDto.reason);
    return {
      statusCode: HttpStatus.CREATED,
      success: true,
      message: 'Post reported successfully',
      data,
    };
  }

  @Post(':id/comment')
  @ApiOperation({ summary: 'Add a comment to a post' })
  @ApiBody({ type: CreateCommentDto })
  async addComment(
    @Req() req,
    @Param('id') id: string,
    @Body() createCommentDto: CreateCommentDto,
  ) {
    const data = await this.postService.addComment(
      req.user.id,
      id,
      createCommentDto.text,
      createCommentDto.parentCommentId,
    );
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Comment added successfully',
      data,
    };
  }

  @Delete('comment/:commentId')
  @ApiOperation({ summary: 'Delete a comment' })
  async removeComment(@Req() req, @Param('commentId') commentId: string) {
    const data = await this.postService.removeComment(req.user.id, commentId);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Comment deleted successfully',
      data,
    };
  }
}
