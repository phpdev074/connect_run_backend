import {
  Body, Controller, Get, Patch, Post, Req, UseGuards, HttpStatus, Query, Delete,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/create-auth.dto';
import { UpdateProfileDto } from './dto/update-auth.dto';
import { AuthGuard } from '@nestjs/passport';
import { UsersService } from 'src/users/users.service';
import { UserSearchDto } from 'src/users/dto/user-search.dto';
import { ChangePasswordDto } from 'src/users/dto/change-password.dto';
import { ForgotPasswordDto } from 'src/users/dto/forgot-password.dto';
import { VerifyOtpDto } from 'src/users/dto/verify-otp.dto';
import { ResetPasswordDto } from 'src/users/dto/reset-password.dto';


@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userServices: UsersService,
  ) { }

  @Post('register')
  @ApiOperation({ summary: 'Create Account' })
  async register(@Body() dto: RegisterDto) {
    const data = await this.authService.registerUser(dto);

    return {
      statusCode: HttpStatus.CREATED,
      success: true,
      message: 'User registered successfully',
      data,
    };
  }


  @Post('login')
  @ApiOperation({ summary: 'Login user' })
  async login(@Body() dto: LoginDto) {
    const data = await this.authService.login(dto);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Login successful',
      data,
    };
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Get('profile')
  @ApiOperation({ summary: 'Get user profile' })
  async getProfile(@Req() req) {
    const data = await this.authService.findById(req.user.id);

    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Profile fetched successfully',
      data,
    };
  }


  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Get('get-user-list')
  @ApiOperation({ summary: 'Get user list with filters' })
  async getUserList(
    @Query() query: UserSearchDto,
  ) {
    const data = await this.userServices.findAll(query);

    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Users fetched successfully',
      data,
    };
  }



  // ✅ UPDATE PROFILE
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Patch('profile')
  @ApiOperation({ summary: 'Update profile' })
  async updateProfile(@Req() req, @Body() dto: UpdateProfileDto) {
    const data = await this.authService.update(req.user.id, dto);

    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Profile updated successfully',
      data,
    };
  }

  // ✅ LOGOUT
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Post('logout')
  @ApiOperation({ summary: 'Logout user' })
  async logout(@Req() req) {
    await this.authService.update(req.user.id, { deviceToken: null });

    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Logged out successfully',
      data: null,
    };
  }

  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @Delete('delete-account')
  @ApiOperation({ summary: 'Delete account' })
  async deleteAccount(@Query('userId') userId: string,) {
    const data = await this.authService.removeAccount(userId);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: 'Account deleted successfully',
      data,
    };
  }
  // ✅ CHANGE PASSWORD
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'User change password' })
  @Patch('change-password')
  async changePassword(@Req() req, @Body() dto: ChangePasswordDto) {
    const data = await this.userServices.changePassword(req.user.id, dto);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: data.message || 'Password changed successfully',
      data: null,
    };
  }

  // ✅ FORGOT PASSWORD
  @ApiOperation({ summary: 'User forget password' })
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    const data = await this.userServices.forgotPassword(dto);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: data.message || 'OTP sent to email',
      data: null,
    };
  }

  // ✅ VERIFY OTP
  @ApiOperation({ summary: 'Verify OTP' })
  @Post('verify-otp')
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    const data = await this.userServices.verifyOtp(dto);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: data.message || 'OTP verified successfully',
      data: null,
    };
  }

  // ✅ RESET PASSWORD
  @ApiOperation({ summary: 'Reset password' })
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    const data = await this.userServices.resetPassword(dto);
    return {
      statusCode: HttpStatus.OK,
      success: true,
      message: data.message || 'Password reset successfully',
      data: null,
    };
  }
}
