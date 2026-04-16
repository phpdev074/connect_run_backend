import {
  Body, Controller, Get, Patch, Post, Req, UseGuards, HttpStatus, Query, Delete, Header, Redirect
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiExcludeEndpoint } from '@nestjs/swagger';
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
    const data = await this.authService.forgotPassword(dto);
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

  // ✅ PAGE TO RESET PASSWORD
  @ApiExcludeEndpoint()
  @Get('reset-password-page')
  @Header('Content-Type', 'text/html')
  resetPasswordPage(@Query('email') email: string) {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Reset Password - ConnectRun</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap');
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Inter', sans-serif; min-height: 100vh; display: flex; align-items: center; justify-content: center; background-color: #f8fafc; color: #1e293b; padding: 20px; }
          .container { width: 100%; max-width: 400px; background: white; padding: 40px 30px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.04); border: 1px solid #f1f5f9; }
          .header { text-align: center; margin-bottom: 30px; }
          .logo-text { font-size: 16px; letter-spacing: 2px; font-weight: 700; text-transform: uppercase; color: #f97316; }
          h1 { font-size: 26px; font-weight: 600; margin-bottom: 10px; color: #0f172a; text-align: center; }
          p.subtitle { color: #64748b; font-size: 14px; margin-bottom: 30px; text-align: center; line-height: 1.5; }
          .form-group { margin-bottom: 20px; position: relative; text-align: left; }
          .form-group label { display: block; color: #334155; font-size: 13px; margin-bottom: 8px; font-weight: 500; }
          .input-wrapper { position: relative; }
          .form-group input { width: 100%; padding: 12px 40px 12px 14px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 14px; outline: none; transition: all 0.2s; color: #0f172a; }
          .form-group input:focus { border-color: #f97316; box-shadow: 0 0 0 3px rgba(249,115,22,0.1); }
          .toggle-password { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 16px; padding: 2px; }
          .btn { width: 100%; padding: 14px; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer; transition: background 0.2s; background-color: #f97316; color: #fff; margin-top: 10px; }
          .btn:hover:not(:disabled) { background-color: #ea580c; }
          .btn:disabled { opacity: 0.6; cursor: not-allowed; }
          .message { margin-top: 20px; padding: 12px; border-radius: 6px; font-size: 13px; text-align: center; display: none; }
          .message.error { background: #fef2f2; border: 1px solid #fee2e2; color: #ef4444; display: block; }
          .success-view { text-align: center; display: none; padding: 10px 0; }
          .success-icon { width: 60px; height: 60px; border-radius: 50%; background: #ecfdf5; color: #10b981; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 28px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo-text">ConnectRun</div>
          </div>
          <div id="formView">
            <h1>Reset Password</h1>
            <p class="subtitle">Enter your new password below for your ConnectRun account.</p>
            <form id="resetForm" novalidate>
              <div class="form-group">
                <label>New Password</label>
                <div class="input-wrapper">
                  <input type="password" id="password" placeholder="Min. 5 characters" required minlength="5" />
                  <button type="button" class="toggle-password" onclick="toggleVis('password', this)">👁</button>
                </div>
              </div>
              <div class="form-group">
                <label>Confirm Password</label>
                <div class="input-wrapper">
                  <input type="password" id="confirmPassword" placeholder="Confirm your new password" required minlength="5" />
                  <button type="button" class="toggle-password" onclick="toggleVis('confirmPassword', this)">👁</button>
                </div>
              </div>
              <button type="submit" class="btn" id="submitBtn">Update Password</button>
            </form>
            <div class="message" id="msg"></div>
          </div>
          <div class="success-view" id="successView">
            <div class="success-icon">✓</div>
            <h1>Password Updated</h1>
            <p class="subtitle">Your password has been changed successfully. You can safely close this page and navigate back to the ConnectRun app.</p>
          </div>
        </div>
        <script>
          const email = new URLSearchParams(window.location.search).get('email');
          const form = document.getElementById('resetForm');
          const msg = document.getElementById('msg');
          const submitBtn = document.getElementById('submitBtn');

          if (!email) {
            showMsg('Invalid or missing account email.', 'error');
            submitBtn.disabled = true;
          }

          form.addEventListener('submit', async (e) => {
            e.preventDefault();
            hideMsg();
            const password = document.getElementById('password').value.trim();
            const confirmPassword = document.getElementById('confirmPassword').value.trim();

            if (!password || password.length < 5) return showMsg('Password must be at least 5 characters.', 'error');
            if (password !== confirmPassword) return showMsg('Passwords do not match.', 'error');

            submitBtn.disabled = true;
            submitBtn.innerHTML = 'Updating...';

            try {
              const res = await fetch('/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, newPassword: password }),
              });
              const data = await res.json();
              if (data.success) {
                document.getElementById('formView').style.display = 'none';
                document.getElementById('successView').style.display = 'block';
              } else {
                showMsg(data.message || 'Failed to update password.', 'error');
                submitBtn.disabled = false;
                submitBtn.innerHTML = 'Update Password';
              }
            } catch (err) {
              showMsg('Something went wrong. Please try again.', 'error');
              submitBtn.disabled = false;
              submitBtn.innerHTML = 'Update Password';
            }
          });

          function showMsg(text, type) { msg.textContent = text; msg.className = 'message ' + type; }
          function hideMsg() { msg.className = 'message'; msg.textContent = ''; }
          function toggleVis(inputId, btn) {
            const input = document.getElementById(inputId);
            if (input.type === 'password') { input.type = 'text'; btn.textContent = '🙈'; }
            else { input.type = 'password'; btn.textContent = '👁'; }
          }
        </script>
      </body>
      </html>
    `;
  }

  @ApiExcludeEndpoint()
  @Get('verify-email')
  @Header('Content-Type', 'text/html')
  async verifyEmail(@Query('token') token: string) {
    if (!token) {
      return '<h1>Invalid Token</h1>';
    }
    const user: any = await this.userServices.findByVerificationToken(token);
    if (!user) {
      return '<h1>Invalid or Expired Token</h1>';
    }

    await this.userServices.update(user._id, {
      isEmailVerified: true,
      emailVerificationToken: null,
    });

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verified - ConnectRun</title>
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
          .card { background: white; padding: 50px 40px; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.04); text-align: center; max-width: 420px; width: 100%; border: 1px solid #f1f5f9; }
          .icon { width: 70px; height: 70px; border-radius: 50%; background: #ecfdf5; color: #10b981; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; font-size: 32px; font-weight: bold; }
          h1 { color: #0f172a; font-size: 26px; font-weight: 600; margin-bottom: 15px; margin-top: 0; }
          p { color: #64748b; font-size: 15px; line-height: 1.6; margin-bottom: 0; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">✓</div>
          <h1>Email Verified!</h1>
          <p>Your email has been successfully verified. You can now close this page and start using all the features of the ConnectRun app.</p>
        </div>
      </body>
      </html>
    `;
  }
}
