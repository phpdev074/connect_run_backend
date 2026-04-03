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

    const user = await this.usersService.create({
      ...dto,
      password: hashedPassword,
    });

    this.mailService.sendMail(dto.email, 'Welcome to ConnectRun 🎉', buildWelcomeMessage(dto.first_name || dto.full_name || dto.name))
      .catch(err => console.error('Welcome email failed:', err));

    const isNewUser = true;
    return this.signToken(user, isNewUser);
  }



  async loginWithEmail(dto: LoginEmailDto) {
    const user = await this.usersService.findByEmail(dto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
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
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid email or password');

    if (!user.password) {
      throw new UnauthorizedException('Invalid email or password');
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

}
