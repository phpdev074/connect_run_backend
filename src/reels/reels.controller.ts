import { Controller, Get, Post, Body, Param, Req, UseGuards, HttpStatus } from '@nestjs/common';
import { ReelsService } from './reels.service';
import { CreateReelDto } from './dto/create-reel.dto';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Reels')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('reels')
export class ReelsController {
  constructor(private readonly reelsService: ReelsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new reel' })
  async create(@Req() req, @Body() createReelDto: CreateReelDto) {
    const data = await this.reelsService.create(req.user.id, createReelDto);
    return {
      statusCode: HttpStatus.CREATED,
      success: true,
      message: 'Reel created successfully',
      data,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get all reels for feed' })
  async findAll() {
    const data = await this.reelsService.findAll();
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Reels fetched successfully',
      data,
    };
  }

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get reels by user ID' })
  async findByUserId(@Param('userId') userId: string) {
    const data = await this.reelsService.findByUserId(userId);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'User reels fetched successfully',
      data,
    };
  }

  @Post(':id/like')
  @ApiOperation({ summary: 'Like/Unlike a reel' })
  async like(@Req() req, @Param('id') id: string) {
    const data = await this.reelsService.like(req.user.id, id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Reel like status toggled',
      data,
    };
  }

  @Post(':id/comment')
  @ApiOperation({ summary: 'Add a comment to a reel' })
  async addComment(@Req() req, @Param('id') id: string, @Body('text') text: string) {
    const data = await this.reelsService.addComment(req.user.id, id, text);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Comment added successfully',
      data,
    };
  }
}
