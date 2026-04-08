import { Controller, Get, Post, Body, Req, UseGuards, Param, HttpStatus } from '@nestjs/common';
import { RewardsService } from './rewards.service';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Rewards')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('rewards')
export class RewardsController {
  constructor(private readonly rewardsService: RewardsService) {}

  @Get('balance')
  @ApiOperation({ summary: 'Get current point balance' })
  async getBalance(@Req() req) {
    const data = await this.rewardsService.getBalance(req.user.id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Balance fetched successfully',
      balance: data,
    };
  }

  @Get('history')
  @ApiOperation({ summary: 'Get point transaction history' })
  async getHistory(@Req() req) {
    const data = await this.rewardsService.getHistory(req.user.id);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Transaction history fetched successfully',
      data,
    };
  }

  @Post('redeem/boost')
  @ApiOperation({ summary: 'Redeem a boost' })
  async redeemBoost(@Req() req, @Body('boostType') boostType: string) {
    const data = await this.rewardsService.redeemBoost(req.user.id, boostType);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: `Boost ${boostType} redeemed successfully`,
      data,
    };
  }

  @Post('send/gift')
  @ApiOperation({ summary: 'Send a gift to another user' })
  async sendGift(@Req() req, @Body('targetId') targetId: string, @Body('giftType') giftType: string) {
    const data = await this.rewardsService.sendGift(req.user.id, targetId, giftType);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: `Gift ${giftType} sent successfully`,
      data,
    };
  }

  @Post('donate')
  @ApiOperation({ summary: 'Donate a mile' })
  async donate(@Req() req, @Body('charityName') charityName: string, @Body('miles') miles: number) {
    const data = await this.rewardsService.donate(req.user.id, charityName, miles);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: `Donated ${miles} mile(s) to ${charityName} successfully`,
      data,
    };
  }
}
