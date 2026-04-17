import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { LoginEmailDto } from './dto/login-phone.dto';
import { generateRandomPassword } from 'src/utils/pin.util';
import { MailService } from 'src/Mail/mail.service';
import { buildWelcomeMessage } from 'src/Mail/templates/welcome-email.template';
import { ForgotPasswordDto } from 'src/users/dto/forgot-password.dto';
import { buildForgotPasswordEmail } from 'src/Mail/templates/forgot-password.template';


@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
  ) { }


  async register(dto: any) {
    const [exist, hashedPassword] = await Promise.all([
      this.usersService.findByEmail(dto.email),
      bcrypt.hash(dto.password || generateRandomPassword(), 10)
    ]);

    if (exist) {
      throw new BadRequestException('Email already registered');
    }

    const user = await this.usersService.create({
      ...dto,
      password: hashedPassword,
    });

    const isNewUser = true;
    this.mailService.sendMail(
      dto.email,
      'Welcome to ConnectRun 🎉',
      buildWelcomeMessage(dto.first_name || dto.full_name || dto.name),
    ).catch(err => console.error('Welcome email failed:', err));

    return this.signToken(user, isNewUser);
  }

  async registerUser(dto: any) {
    const [exist, hashedPassword] = await Promise.all([
      this.usersService.findByEmail(dto.email),
      bcrypt.hash(dto.password || generateRandomPassword(), 10)
    ]);

    if (exist) {
      throw new BadRequestException('Email already registered');
    }

    if (dto.latitude && dto.longitude) {
      dto.location = {
        type: 'Point',
        coordinates: [dto.longitude, dto.latitude],
      };
    }

    const verificationToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);

    const user = await this.usersService.create({
      ...dto,
      password: hashedPassword,
      emailVerificationToken: verificationToken,
    });

    const verifyLink = `http://85.31.234.205:3030/auth/verify-email?token=${verificationToken}`;

    const emailTemplate = `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f9f9f9; padding: 40px 0; margin: 0; text-align: center;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-radius: 12px; border: 1px solid #eeeeee; box-shadow: 0 4px 15px rgba(0,0,0,0.05); text-align: left;">
          <div style="text-align: center; font-size: 18px; letter-spacing: 2px; font-weight: 700; margin-bottom: 30px; color: #4CAF50; text-transform: uppercase;">
            ConnectRun
          </div>
          <h1 style="color: #1e293b; font-size: 26px; font-weight: 600; margin-bottom: 20px; text-align: center; margin-top: 0;">
            Verify your email
          </h1>
          <p style="color: #64748b; font-size: 16px; line-height: 1.6; text-align: center; margin-bottom: 30px;">
            Thank you for registering at ConnectRun. Please click the button below to verify your email address.
          </p>
          <div style="text-align: center; margin: 35px 0;">
            <a href="${verifyLink}" style="display: inline-block; padding: 14px 35px; background-color: #4CAF50; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
              Verify Email
            </a>
          </div>
        </div>
      </div>
    `;

    this.mailService.sendMail(dto.email, 'Welcome to ConnectRun 🎉 - Verify Email', emailTemplate)
      .catch(err => console.error('Verification email failed:', err));

    const isNewUser = true;
    return this.signToken(user, isNewUser);
  }



  async loginWithEmail(dto: LoginEmailDto) {
    const user: any = await this.usersService.findByEmail(dto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isEmailVerified) {
      throw new UnauthorizedException('Please verify your email address before logging in.');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isNewUser = false;

    return this.generateAuthResponse(user, isNewUser);
  }


  private generateAuthResponse(user: any, isNewUser: boolean) {
    const payload = {
      sub: user._id,
      phone: user.phone,
      countryCode: user.countryCode,
      email: user.email ?? null,
    };

    return {
      message: user.name ? "Login Successful" : "Signup Successful",
      isNewUser: isNewUser,
      access_token: this.jwtService.sign(payload),
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        countryCode: user.countryCode,
        email: user.email ?? null,
      },
    };
  }


  private signToken(user: any, isNewUser: boolean) {
    const payload = {
      sub: user._id,
      phone: user.phone,
      countryCode: user.countryCode,
      email: user.email ?? null,
    };

    return {
      access_token: this.jwtService.sign(payload),
      isNewUser,
      user: {
        id: user._id,
        phone: user.phone,
        countryCode: user.countryCode,
        email: user.email ?? null,
        full_name: user.full_name ?? null,
      },
    };
  }

  async login(dto: LoginDto) {
    const user: any = await this.usersService.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid email or password');

    if (!user.isEmailVerified) {
      throw new UnauthorizedException('Please verify your email address before logging in.');
    }

    if (!user.password) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isEmailVerified) {
      throw new UnauthorizedException('Please verify your email');
    }

    const match = await bcrypt.compare(dto.password, user?.password);

    if (!match) throw new UnauthorizedException('Invalid email or password');
    const isNewUser = false
    return this.signToken(user, isNewUser);
  }

  async removeAccount(userId: string) {
    const user = await this.usersService.findById(userId)
    if (!user) throw new NotFoundException('User not found');
    return this.usersService.remove(userId);
  }

  async findById(id: string) {
    const user = await this.usersService.findById(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, dto: any) {
    if (dto.latitude && dto.longitude) {
      dto.location = {
        type: 'Point',
        coordinates: [dto.longitude, dto.latitude],
      };
    }
    const user = await this.usersService.update(id, dto);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user: any = await this.usersService.findByEmail(dto.email);
    if (!user) throw new BadRequestException('Email not registered');

    // Server is on port 3030 per .env
    const resetLink = `http://85.31.234.205:3030/auth/reset-password-page?email=${encodeURIComponent(dto.email)}`;

    const emailTemplate = `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f9f9f9; padding: 40px 0; margin: 0; text-align: center;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-radius: 12px; border: 1px solid #eeeeee; box-shadow: 0 4px 15px rgba(0,0,0,0.05); text-align: left;">
          
          <div style="text-align: center; font-size: 18px; letter-spacing: 2px; font-weight: 700; margin-bottom: 30px; color: #4CAF50; text-transform: uppercase;">
            ConnectRun
          </div>
          
          <h1 style="color: #1e293b; font-size: 26px; font-weight: 600; margin-bottom: 20px; text-align: center; margin-top: 0;">
            Reset your password
          </h1>
          
          <p style="color: #64748b; font-size: 16px; line-height: 1.6; text-align: center; margin-bottom: 30px;">
            We received a request to reset your password. Click the button below to set a new password. This link is valid for <strong>10 minutes</strong>.
          </p>
          
          <div style="text-align: center; margin: 35px 0;">
            <a href="${resetLink}" style="display: inline-block; padding: 14px 35px; background-color: #4CAF50; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
              Reset Password
            </a>
          </div>
          
          <p style="color: #64748b; font-size: 15px; line-height: 1.6; text-align: center;">
            If you didn't request a password reset, you can safely ignore this email.
          </p>
          
          <div style="margin-top: 40px; font-size: 13px; color: #94a3b8; text-align: center; border-top: 1px solid #f1f5f9; padding-top: 20px;">
            &copy; ${new Date().getFullYear()} ConnectRun. All rights reserved.
          </div>
          
        </div>
      </div>
    `;

    this.mailService.sendMail(
      dto.email,
      'ConnectRun Password Reset',
      emailTemplate
    ).catch(err => console.error('Forgot password email failed:', err));

    return { message: 'Password reset link sent to email' };
  }

  async checkEmail(email: string) {
    const user = await this.usersService.findByEmail(email);
    return {
      exists: !!user,
      // isEmailVerified: user ? user.isEmailVerified : false,
      message: user ? 'Email already registered' : 'Email is available',
    };
  }


}
