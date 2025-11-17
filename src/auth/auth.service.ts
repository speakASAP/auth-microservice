/**
 * Auth Service
 */

import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { LoggerService } from '../../shared/logger/logger.service';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly logger: LoggerService,
  ) {}

  async register(registerDto: RegisterDto) {
    // Check if user already exists
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      this.logger.warn(`Registration attempt with existing email: ${registerDto.email}`, 'AuthService');
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    // Create user
    const user = await this.usersService.create({
      email: registerDto.email,
      password: hashedPassword,
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
      phone: registerDto.phone,
      isActive: true,
      isVerified: false,
    });

    // Generate tokens
    const tokens = await this.generateTokens(user.id);

    this.logger.log(`User registered successfully: ${user.email}`, 'AuthService');

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async login(loginDto: LoginDto) {
    // Find user
    const user = await this.usersService.findByEmail(loginDto.email);
    if (!user) {
      this.logger.warn(`Login attempt with non-existent email: ${loginDto.email}`, 'AuthService');
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
    if (!isPasswordValid) {
      this.logger.warn(`Login attempt with invalid password for: ${loginDto.email}`, 'AuthService');
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if user is active
    if (!user.isActive) {
      this.logger.warn(`Login attempt for inactive user: ${loginDto.email}`, 'AuthService');
      throw new UnauthorizedException('User account is inactive');
    }

    // Generate tokens
    const tokens = await this.generateTokens(user.id);

    this.logger.log(`User logged in successfully: ${user.email}`, 'AuthService');

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async validateToken(token: string) {
    try {
      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET,
      });

      const user = await this.usersService.findById(payload.sub);
      if (!user || !user.isActive) {
        this.logger.warn(`Token validation failed: user not found or inactive`, 'AuthService');
        throw new UnauthorizedException('Invalid token');
      }

      this.logger.log(`Token validated successfully for user: ${user.email}`, 'AuthService');

      return this.sanitizeUser(user);
    } catch (error) {
      this.logger.error(`Token validation failed: ${error.message}`, error.stack, 'AuthService');
      throw new UnauthorizedException('Invalid token');
    }
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_SECRET,
      });

      const user = await this.usersService.findById(payload.sub);
      if (!user || !user.isActive) {
        this.logger.warn(`Refresh token validation failed: user not found or inactive`, 'AuthService');
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Generate new tokens
      const tokens = await this.generateTokens(user.id);

      this.logger.log(`Token refreshed successfully for user: ${user.email}`, 'AuthService');

      return {
        user: this.sanitizeUser(user),
        ...tokens,
      };
    } catch (error) {
      this.logger.error(`Refresh token validation failed: ${error.message}`, error.stack, 'AuthService');
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async validateUser(userId: string): Promise<User | null> {
    const user = await this.usersService.findById(userId);
    if (!user || !user.isActive) {
      return null;
    }
    return user;
  }

  private async generateTokens(userId: string) {
    const payload = { sub: userId };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });

    const refreshToken = this.jwtService.sign(payload, {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    });

    return {
      accessToken,
      refreshToken,
    };
  }

  private sanitizeUser(user: User) {
    const { password, ...sanitized } = user;
    return sanitized;
  }
}

