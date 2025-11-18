/**
 * Auth Service
 */

import { Injectable, UnauthorizedException, ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { PasswordResetRequestDto } from './dto/password-reset-request.dto';
import { PasswordResetConfirmDto } from './dto/password-reset-confirm.dto';
import { PasswordChangeDto } from './dto/password-change.dto';
import { ContactRegisterDto } from './dto/contact-register.dto';
import { LoggerService } from '../../shared/logger/logger.service';
import { User } from '../users/entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PasswordResetToken } from './entities/password-reset-token.entity';

@Injectable()
export class AuthService {
  private readonly notificationsServiceUrl: string;

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly logger: LoggerService,
    private readonly httpService: HttpService,
    @InjectRepository(PasswordResetToken)
    private readonly passwordResetTokenRepository: Repository<PasswordResetToken>,
  ) {
    this.notificationsServiceUrl = process.env.NOTIFICATIONS_SERVICE_URL || 'https://notifications.statex.cz';
  }

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

  async requestPasswordReset(passwordResetRequestDto: PasswordResetRequestDto) {
    const user = await this.usersService.findByEmail(passwordResetRequestDto.email);
    if (!user) {
      // Don't reveal if user exists or not for security
      this.logger.warn(`Password reset requested for non-existent email: ${passwordResetRequestDto.email}`, 'AuthService');
      return { message: 'If the email exists, a password reset link has been sent.' };
    }

    // Generate reset token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Token expires in 1 hour

    // Save reset token
    const resetToken = this.passwordResetTokenRepository.create({
      userId: user.id,
      token,
      expiresAt,
      used: false,
    });
    await this.passwordResetTokenRepository.save(resetToken);

    // Send password reset email via notifications-microservice
    const resetUrl = `${process.env.FRONTEND_URL || 'https://statex.cz'}/reset-password?token=${token}`;
    try {
      await firstValueFrom(
        this.httpService.post(`${this.notificationsServiceUrl}/notifications/send`, {
          channel: 'email',
          type: 'custom',
          recipient: user.email,
          subject: 'Password Reset Request',
          message: `Click the following link to reset your password: ${resetUrl}\n\nThis link will expire in 1 hour.`,
        }),
      );
      this.logger.log(`Password reset email sent to: ${user.email}`, 'AuthService');
    } catch (error) {
      this.logger.error(`Failed to send password reset email: ${error.message}`, error.stack, 'AuthService');
      // Continue even if email fails - token is still generated
    }

    return { message: 'If the email exists, a password reset link has been sent.' };
  }

  async confirmPasswordReset(passwordResetConfirmDto: PasswordResetConfirmDto) {
    const resetToken = await this.passwordResetTokenRepository.findOne({
      where: { token: passwordResetConfirmDto.token, used: false },
      relations: ['user'],
    });

    if (!resetToken) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    if (new Date() > resetToken.expiresAt) {
      throw new BadRequestException('Reset token has expired');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(passwordResetConfirmDto.newPassword, 10);

    // Update user password
    await this.usersService.updatePassword(resetToken.userId, hashedPassword);

    // Mark token as used
    resetToken.used = true;
    await this.passwordResetTokenRepository.save(resetToken);

    this.logger.log(`Password reset completed for user: ${resetToken.userId}`, 'AuthService');

    return { message: 'Password reset successfully' };
  }

  async changePassword(userId: string, passwordChangeDto: PasswordChangeDto) {
    const user = await this.usersService.findById(userId);
    if (!user || !user.password) {
      throw new NotFoundException('User not found or password not set');
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(passwordChangeDto.currentPassword, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(passwordChangeDto.newPassword, 10);

    // Update password
    await this.usersService.updatePassword(userId, hashedPassword);

    this.logger.log(`Password changed for user: ${user.email}`, 'AuthService');

    return { message: 'Password changed successfully' };
  }

  async registerContact(contactRegisterDto: ContactRegisterDto) {
    // Check if user already exists by contact info
    let existingUser: User | null = null;
    for (const contact of contactRegisterDto.contactInfo) {
      if (contact.type === 'email') {
        existingUser = await this.usersService.findByEmail(contact.value);
      } else if (contact.type === 'phone') {
        existingUser = await this.usersService.findByPhone(contact.value);
      } else {
        existingUser = await this.usersService.findByContact(contact.type, contact.value);
      }
      if (existingUser) break;
    }

    if (existingUser) {
      // Update existing user - add new contact info if not present
      const existingContacts = existingUser.contactInfo || [];
      const newContacts = [...existingContacts];

      for (const newContact of contactRegisterDto.contactInfo) {
        const contactExists = existingContacts.some(
          (c) => c.type === newContact.type && c.value === newContact.value,
        );
        if (!contactExists) {
          newContacts.push({
            type: newContact.type,
            value: newContact.value,
            isPrimary: newContact.isPrimary || false,
          });
        }
      }

      existingUser.contactInfo = newContacts;
      existingUser.name = contactRegisterDto.name || existingUser.name;
      existingUser.lastActivity = new Date();
      existingUser.source = contactRegisterDto.source || existingUser.source;
      existingUser.sessionId = contactRegisterDto.sessionId || existingUser.sessionId;

      const updatedUser = await this.usersService.update(existingUser.id, existingUser);

      // Generate session token (not JWT, just a session identifier)
      const sessionToken = crypto.randomBytes(32).toString('hex');

      this.logger.log(`Contact-based user updated: ${updatedUser.id}`, 'AuthService');

      return {
        success: true,
        userId: updatedUser.id,
        sessionId: sessionToken,
        message: 'User profile updated',
        isNewUser: false,
        user: this.sanitizeUser(updatedUser),
      };
    } else {
      // Create new user
      const primaryContact = contactRegisterDto.contactInfo.find((c) => c.isPrimary) || contactRegisterDto.contactInfo[0];
      const email = primaryContact.type === 'email' ? primaryContact.value : null;
      const phone = primaryContact.type === 'phone' ? primaryContact.value : null;

      const newUser = await this.usersService.create({
        email,
        phone,
        name: contactRegisterDto.name,
        contactInfo: contactRegisterDto.contactInfo.map((c) => ({
          type: c.type,
          value: c.value,
          isPrimary: c.isPrimary || false,
        })),
        password: null, // No password for contact-based users
        isActive: true,
        isVerified: false,
        lastActivity: new Date(),
        source: contactRegisterDto.source,
        sessionId: contactRegisterDto.sessionId,
      });

      // Generate session token
      const sessionToken = crypto.randomBytes(32).toString('hex');

      this.logger.log(`Contact-based user registered: ${newUser.id}`, 'AuthService');

      return {
        success: true,
        userId: newUser.id,
        sessionId: sessionToken,
        message: 'User registered successfully',
        isNewUser: true,
        user: this.sanitizeUser(newUser),
      };
    }
  }

  async loginContact(type: string, value: string) {
    let user: User | null = null;

    if (type === 'email') {
      user = await this.usersService.findByEmail(value);
    } else if (type === 'phone') {
      user = await this.usersService.findByPhone(value);
    } else {
      user = await this.usersService.findByContact(type, value);
    }

    if (!user) {
      throw new UnauthorizedException('Invalid contact information');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is inactive');
    }

    // Update last activity
    user.lastActivity = new Date();
    await this.usersService.update(user.id, { lastActivity: user.lastActivity });

    // Generate session token (not JWT for contact-based users without password)
    const sessionToken = crypto.randomBytes(32).toString('hex');

    this.logger.log(`Contact-based login successful: ${user.id}`, 'AuthService');

    return {
      user: this.sanitizeUser(user),
      sessionId: sessionToken,
    };
  }

  private sanitizeUser(user: User) {
    const { password, ...sanitized } = user;
    return sanitized;
  }
}

