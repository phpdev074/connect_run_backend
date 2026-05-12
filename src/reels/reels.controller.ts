import { Controller, Get, Post, Body, Param, Req, Res, UseGuards, HttpStatus, NotFoundException } from '@nestjs/common';
import * as express from 'express';
import { createReadStream, statSync, existsSync } from 'fs';
import { join } from 'path';
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

  @Get('stream/:filename')
  @ApiOperation({ summary: 'Stream reel video' })
  async streamVideo(@Param('filename') filename: string, @Req() req: express.Request, @Res() res: express.Response) {
    const filePath = join(process.cwd(), 'uploads', filename);

    if (!existsSync(filePath)) {
      throw new NotFoundException('Video file not found');
    }

    const stat = statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize) {
        res.status(HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE).send('Requested range not satisfiable\n' + start + ' >= ' + fileSize);
        return;
      }

      const chunksize = end - start + 1;
      const file = createReadStream(filePath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
      };

      res.writeHead(HttpStatus.PARTIAL_CONTENT, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
      };
      res.writeHead(HttpStatus.OK, head);
      createReadStream(filePath).pipe(res);
    }
  }
}
