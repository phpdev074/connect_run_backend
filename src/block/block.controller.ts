import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  Query,
} from "@nestjs/common";
import { BlockService } from "./block.service";
import { CreateBlockDto } from "./dto/create-block.dto";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ApiBearerAuth, ApiOperation, ApiQuery } from "@nestjs/swagger";

@Controller("block")
export class BlockController {
  constructor(private readonly blockService: BlockService) {}

  @ApiOperation({ summary: "Toggle block/unblock a user" })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post()
  toggleBlock(@Body() createBlockDto: CreateBlockDto, @Req() req) {
    return this.blockService.toggleBlock(
      req.user.id,
      createBlockDto.blockedId,
    );
  }

  @ApiOperation({ summary: "Get list of blocked users" })
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get()
  @ApiQuery({ name: "page", required: false, type: Number, example: 1 })
  @ApiQuery({ name: "limit", required: false, type: Number, example: 10 })
  getBlockedUsers(
    @Req() req,
    @Query("page") page = 1,
    @Query("limit") limit = 10,
  ) {
    return this.blockService.getBlockedUsers(req.user.id, +page, +limit);
  }
}
