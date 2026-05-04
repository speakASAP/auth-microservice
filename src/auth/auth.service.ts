/**
 * Auth Service
 */

import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as bcrypt from 'bcrypt';
import * as bcryptjs from 'bcryptjs';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';
import { RolesService } from '../roles/roles.service';
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
import { MagicLinkToken } from './entities/magic-link-token.entity';
import { MagicLinkRequestDto } from './dto/magic-link-request.dto';
import { MagicLinkVerifyDto } from './dto/magic-link-verify.dto';
import { Response } from 'express';

@Injectable()
export class AuthService {
  private readonly notificationsServiceUrl: string;
  private readonly magicLinkTtlMinutes: number;
  private readonly magicLinkRateLimitPerIp: number;
  private readonly magicLinkRateLimitPerEmail: number;
  private readonly oauthInitRateLimitPerIp: number;
  private readonly rateLimitWindowMs: number;
  private readonly allowedRedirectOrigins: string[];
  private readonly oauthStateStore = new Map<string, { provider: string; returnUrl: string; clientId?: string; appState?: string; createdAt: number }>();
  private readonly rateLimitStore = new Map<string, { count: number; windowStart: number }>();

  constructor(
    private readonly usersService: UsersService,
    private readonly rolesService: RolesService,
    private readonly jwtService: JwtService,
    private readonly logger: LoggerService,
    private readonly httpService: HttpService,
    @InjectRepository(PasswordResetToken)
    private readonly passwordResetTokenRepository: Repository<PasswordResetToken>,
    @InjectRepository(MagicLinkToken)
    private readonly magicLinkTokenRepository: Repository<MagicLinkToken>,
  ) {
    this.notificationsServiceUrl = process.env.NOTIFICATION_SERVICE_URL || '';
    if (!this.notificationsServiceUrl) {
      this.logger.warn('NOTIFICATION_SERVICE_URL is not set. Email notifications will not work.', 'AuthService');
    }

    this.magicLinkTtlMinutes = Number(process.env.AUTH_MAGIC_LINK_TTL_MINUTES || '15');
    this.magicLinkRateLimitPerIp = Number(process.env.AUTH_MAGIC_LINK_RATE_LIMIT_PER_IP || '20');
    this.magicLinkRateLimitPerEmail = Number(process.env.AUTH_MAGIC_LINK_RATE_LIMIT_PER_EMAIL || '10');
    this.oauthInitRateLimitPerIp = Number(process.env.AUTH_OAUTH_INIT_RATE_LIMIT_PER_IP || '60');
    this.rateLimitWindowMs = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || String(15 * 60 * 1000));
    const originsEnv = process.env.AUTH_ALLOWED_REDIRECT_ORIGINS || '';
    this.allowedRedirectOrigins = originsEnv
      .split(',')
      .map((o) => o.trim())
      .filter((o) => o.length > 0);
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
    const tokens = await this.generateTokens(user.id, 'password');

    this.logger.log(`User registered successfully: ${user.email}`, 'AuthService');

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async login(loginDto: LoginDto) {
    try {
      const user = await this.usersService.findByEmail(loginDto.email);
      if (!user) {
        this.logger.warn(`Login attempt with non-existent email: ${loginDto.email}`, 'AuthService');
        throw new UnauthorizedException('Invalid credentials');
      }
      if (!user.password) {
        this.logger.warn(`Login attempt for user without password (contact-based): ${loginDto.email}`, 'AuthService');
        throw new UnauthorizedException('Invalid credentials');
      }
      if (!/^\$2[aby]\$\d{2}\$.+/.test(user.password)) {
        this.logger.warn(`Login attempt for user with invalid password hash format: ${loginDto.email}`, 'AuthService');
        throw new UnauthorizedException('Invalid credentials');
      }

      let isPasswordValid = false;
      try {
        isPasswordValid = await bcryptjs.compare(loginDto.password, user.password);
      } catch (err) {
        this.logger.warn(
          `Password check failed for ${loginDto.email}: ${(err as Error).message}`,
          'AuthService',
        );
        throw new UnauthorizedException('Invalid credentials');
      }
      if (!isPasswordValid) {
        this.logger.warn(`Login attempt with invalid password for: ${loginDto.email}`, 'AuthService');
        throw new UnauthorizedException('Invalid credentials');
      }

      if (!user.isActive) {
        this.logger.warn(`Login attempt for inactive user: ${loginDto.email}`, 'AuthService');
        throw new UnauthorizedException('User account is inactive');
      }

      const tokens = await this.generateTokens(user.id, 'password');
      this.logger.log(`User logged in successfully: ${user.email}`, 'AuthService');
      return {
        user: this.sanitizeUser(user),
        ...tokens,
      };
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      this.logger.error(
        `Login error for ${loginDto.email}: ${(err as Error).message}`,
        (err as Error).stack,
        'AuthService',
      );
      throw new UnauthorizedException('Invalid credentials');
    }
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

      // Get user roles
      const roles = await this.rolesService.getUserRoles(user.id);

      this.logger.log(`Token validated successfully for user: ${user.email}`, 'AuthService');

      const sanitizedUser = this.sanitizeUser(user);
      return {
        ...sanitizedUser,
        roles,
      };
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
      const tokens = await this.generateTokens(user.id, (payload as any).auth_method || 'password');

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

  private async generateTokens(userId: string, authMethod: string) {
    // Get user and roles
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const roles = await this.rolesService.getUserRoles(userId);

    const payload: any = {
      sub: userId,
      email: user.email,
      type: user.userType || 'end_user',
      roles,
    };

    if (authMethod) {
      payload.auth_method = authMethod;
    }

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
    const frontendUrl = process.env.FRONTEND_URL;
    if (!frontendUrl) {
      this.logger.error('FRONTEND_URL is not set. Cannot generate password reset link.', 'AuthService');
      throw new BadRequestException('Frontend URL is not configured');
    }
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;
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

  async requestMagicLink(dto: MagicLinkRequestDto, ip: string) {
    const startedAt = Date.now();
    this.checkRateLimit(`magic_link:ip:${ip}`, this.magicLinkRateLimitPerIp);
    this.checkRateLimit(`magic_link:email:${dto.email.toLowerCase()}`, this.magicLinkRateLimitPerEmail);

    const validReturnUrl = this.validateReturnUrl(dto.return_url);

    let user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      user = await this.usersService.create({
        email: dto.email,
        isActive: true,
        isVerified: false,
      });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + this.magicLinkTtlMinutes * 60 * 1000);

    const magicToken = this.magicLinkTokenRepository.create({
      userId: user.id,
      email: dto.email,
      token,
      returnUrl: validReturnUrl,
      clientId: dto.client_id || null,
      state: dto.state || null,
      expiresAt,
      used: false,
    });
    await this.magicLinkTokenRepository.save(magicToken);

    const domain = process.env.DOMAIN;
    const baseUrl = domain ? `https://${domain}` : process.env.FRONTEND_URL;
    if (!baseUrl) {
      this.logger.error('DOMAIN or FRONTEND_URL is not set. Cannot generate magic link URL.', undefined, 'AuthService');
      throw new BadRequestException('Magic link base URL is not configured');
    }

    const verifyUrl = `${baseUrl}/auth/magic-link/verify?token=${encodeURIComponent(
      token,
    )}&return_url=${encodeURIComponent(validReturnUrl)}`;

    const durationMs = Date.now() - startedAt;
    if (this.notificationsServiceUrl) {
      try {
        await firstValueFrom(
          this.httpService.post(`${this.notificationsServiceUrl}/notifications/send`, {
            channel: 'email',
            type: 'custom',
            recipient: dto.email,
            subject: 'Your sign-in link',
            message: `Click the following link to sign in: ${verifyUrl}\n\nThis link will expire in ${this.magicLinkTtlMinutes} minutes.`,
          }),
        );
        this.logger.log(
          `Magic link requested and email sent for ${dto.email} client_id=${dto.client_id || ''} duration_ms=${durationMs}`,
          'AuthService',
        );
      } catch (error) {
        this.logger.error(
          `Failed to send magic link email for ${dto.email} client_id=${dto.client_id || ''} duration_ms=${durationMs}`,
          (error as Error).stack,
          'AuthService',
        );
      }
    } else {
      this.logger.warn(
        `Magic link created for ${dto.email} but NOTIFICATION_SERVICE_URL not set; email not sent. duration_ms=${durationMs}`,
        'AuthService',
      );
    }

    return { success: true };
  }

  async verifyMagicLink(dto: MagicLinkVerifyDto, res: Response) {
    const startedAt = Date.now();

    let token: MagicLinkToken | null = null;
    try {
      token = await this.magicLinkTokenRepository.findOne({
        where: { token: dto.token, used: false },
        relations: ['user'],
      });
    } catch (err) {
      this.logger.error(`Magic link verify lookup failed: ${(err as Error).message}`, (err as Error).stack, 'AuthService');
      this.renderSafeError(res, 'Invalid or expired magic link.');
      return;
    }

    if (!token) {
      this.renderSafeError(res, 'Invalid or expired magic link.');
      return;
    }

    if (new Date() > token.expiresAt) {
      this.renderSafeError(res, 'Magic link has expired.');
      return;
    }

    const finalReturnUrl = this.validateReturnUrl(dto.return_url || token.returnUrl);

    token.used = true;
    await this.magicLinkTokenRepository.save(token);

    const user = await this.usersService.findById(token.userId);
    if (!user) {
      this.renderSafeError(res, 'User not found for magic link.');
      return;
    }

    const tokens = await this.generateTokens(user.id, 'magic_link');
    const decoded = this.jwtService.decode(tokens.accessToken) as { exp?: number } | null;
    const expiresAtIso =
      decoded && decoded.exp ? new Date(decoded.exp * 1000).toISOString() : new Date().toISOString();

    const fragmentParts = [
      `access_token=${encodeURIComponent(tokens.accessToken)}`,
      `refresh_token=${encodeURIComponent(tokens.refreshToken)}`,
      `expires_at=${encodeURIComponent(expiresAtIso)}`,
    ];

    if (token.state) {
      fragmentParts.push(`state=${encodeURIComponent(token.state)}`);
    }

    fragmentParts.push('auth_method=magic_link');

    const redirectUrl = `${finalReturnUrl}#${fragmentParts.join('&')}`;

    const durationMs = Date.now() - startedAt;
    this.logger.log(
      `Magic link verified for ${token.email} client_id=${token.clientId || ''} duration_ms=${durationMs}`,
      'AuthService',
    );

    res.redirect(302, redirectUrl);
  }

  async oauthInit(
    provider: string,
    rawQuery: any,
    ip: string,
  ): Promise<string> {
    const startedAt = Date.now();
    this.checkRateLimit(`oauth_init:ip:${ip}`, this.oauthInitRateLimitPerIp);

    const returnUrl = String(rawQuery.return_url || '');
    const clientId = rawQuery.client_id ? String(rawQuery.client_id) : undefined;
    const appState = rawQuery.state ? String(rawQuery.state) : undefined;

    const validatedReturnUrl = this.validateReturnUrl(returnUrl);

    const config = this.getOAuthConfig(provider);

    const internalState = crypto.randomBytes(16).toString('hex');
    this.oauthStateStore.set(internalState, {
      provider,
      returnUrl: validatedReturnUrl,
      clientId,
      appState,
      createdAt: Date.now(),
    });

    const redirectUri = this.getOAuthRedirectUri(provider);
    const url = new URL(config.authUrl);
    url.searchParams.set('client_id', config.clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', config.scope);
    url.searchParams.set('state', internalState);

    const durationMs = Date.now() - startedAt;
    this.logger.log(
      `OAuth init provider=${provider} client_id=${clientId || ''} duration_ms=${durationMs}`,
      'AuthService',
    );

    return url.toString();
  }

  async oauthCallback(
    provider: string,
    rawQuery: any,
    res: Response,
  ): Promise<void> {
    const startedAt = Date.now();
    const code = String(rawQuery.code || '');
    const state = String(rawQuery.state || '');

    if (!code || !state) {
      this.renderSafeError(res, 'Missing OAuth code or state.');
      return;
    }

    const stateEntry = this.oauthStateStore.get(state);
    if (!stateEntry || stateEntry.provider !== provider) {
      this.renderSafeError(res, 'Invalid OAuth state.');
      return;
    }

    this.oauthStateStore.delete(state);

    const config = this.getOAuthConfig(provider);
    const redirectUri = this.getOAuthRedirectUri(provider);

    let providerEmail = '';
    try {
      const params = new URLSearchParams();
      params.set('code', code);
      params.set('client_id', config.clientId);
      params.set('client_secret', config.clientSecret);
      params.set('redirect_uri', redirectUri);
      params.set('grant_type', 'authorization_code');

      const tokenResponse = await firstValueFrom(
        this.httpService.post(config.tokenUrl, params.toString(), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }),
      );

      // Facebook can return JSON or form-encoded body
      let accessToken: string;
      const tokenData = tokenResponse.data;
      if (typeof tokenData === 'object' && tokenData?.access_token) {
        accessToken = tokenData.access_token as string;
      } else if (typeof tokenData === 'string' && tokenData.includes('access_token=')) {
        const match = tokenData.match(/access_token=([^&]*)/);
        accessToken = match ? decodeURIComponent(match[1]) : '';
      } else {
        accessToken = '';
      }
      if (!accessToken) {
        this.logger.error(
          `OAuth callback token response missing access_token provider=${provider} body=${JSON.stringify(tokenResponse.data)}`,
          undefined,
          'AuthService',
        );
        this.renderSafeError(res, 'OAuth authentication failed.');
        return;
      }

      const profileResponse = await firstValueFrom(
        this.httpService.get(config.profileUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }),
      );

      providerEmail = config.extractEmail(profileResponse.data);
    } catch (error: any) {
      const fbMessage = error?.response?.data?.error?.message || error?.response?.data?.error_description || error?.message;
      const fbCode = error?.response?.data?.error?.code;
      this.logger.error(
        `OAuth callback failed provider=${provider} message=${fbMessage} code=${fbCode || ''} redirect_uri=${redirectUri}`,
        error?.stack,
        'AuthService',
      );
      this.renderSafeError(res, 'OAuth authentication failed.');
      return;
    }

    if (!providerEmail) {
      this.renderSafeError(res, 'OAuth provider did not return an email address.');
      return;
    }

    let user = await this.usersService.findByEmail(providerEmail);
    if (!user) {
      user = await this.usersService.create({
        email: providerEmail,
        isActive: true,
        isVerified: true,
      });
    }

    const tokens = await this.generateTokens(user.id, provider);
    const decoded = this.jwtService.decode(tokens.accessToken) as { exp?: number } | null;
    const expiresAtIso =
      decoded && decoded.exp ? new Date(decoded.exp * 1000).toISOString() : new Date().toISOString();

    const fragmentParts = [
      `access_token=${encodeURIComponent(tokens.accessToken)}`,
      `refresh_token=${encodeURIComponent(tokens.refreshToken)}`,
      `expires_at=${encodeURIComponent(expiresAtIso)}`,
    ];

    if (stateEntry.appState) {
      fragmentParts.push(`state=${encodeURIComponent(stateEntry.appState)}`);
    }

    fragmentParts.push(`auth_method=${encodeURIComponent(provider)}`);

    const redirectUrl = `${stateEntry.returnUrl}#${fragmentParts.join('&')}`;

    const durationMs = Date.now() - startedAt;
    this.logger.log(
      `OAuth callback successful provider=${provider} email=${providerEmail} duration_ms=${durationMs}`,
      'AuthService',
    );

    res.redirect(302, redirectUrl);
  }

  private sanitizeUser(user: User) {
    const { password, ...sanitized } = user;
    return sanitized;
  }

  validateReturnUrlForClient(returnUrl: string): string {
    return this.validateReturnUrl(returnUrl);
  }

  private validateReturnUrl(returnUrl: string): string {
    let url: URL;
    try {
      url = new URL(returnUrl);
    } catch {
      throw new BadRequestException('Invalid return_url');
    }

    if (url.protocol !== 'https:') {
      throw new BadRequestException('return_url must use HTTPS');
    }

    if (this.allowedRedirectOrigins.length === 0) {
      return url.toString();
    }

    const origin = url.origin;
    const allowed = this.allowedRedirectOrigins.some((allowedOrigin) => {
      if (allowedOrigin.startsWith('*.')) {
        const domain = allowedOrigin.substring(2);
        return origin.endsWith(domain);
      }
      return origin === allowedOrigin;
    });

    if (!allowed) {
      throw new BadRequestException('return_url is not allowed');
    }

    return url.toString();
  }

  private renderSafeError(res: Response, message: string): void {
    res.status(400).send(
      `<html><body><h1>Authentication error</h1><p>${message}</p></body></html>`,
    );
  }

  private checkRateLimit(key: string, limit: number): void {
    const now = Date.now();
    const existing = this.rateLimitStore.get(key);
    if (!existing || now - existing.windowStart > this.rateLimitWindowMs) {
      this.rateLimitStore.set(key, { count: 1, windowStart: now });
      return;
    }

    if (existing.count >= limit) {
      throw new HttpException('Too many requests, please try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }

    existing.count += 1;
  }

  private getOAuthConfig(provider: string): {
    authUrl: string;
    tokenUrl: string;
    profileUrl: string;
    clientId: string;
    clientSecret: string;
    scope: string;
    extractEmail: (profile: any) => string;
  } {
    const lower = provider.toLowerCase();
    const domain = process.env.DOMAIN;
    if (!domain) {
      throw new BadRequestException('DOMAIN is not configured for OAuth.');
    }

    if (lower === 'google') {
      const clientId = process.env.GOOGLE_CLIENT_ID || '';
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
      if (!clientId || !clientSecret) {
        throw new BadRequestException('Google OAuth is not configured.');
      }
      return {
        authUrl: process.env.GOOGLE_OAUTH_AUTH_URL || 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: process.env.GOOGLE_OAUTH_TOKEN_URL || 'https://oauth2.googleapis.com/token',
        profileUrl:
          process.env.GOOGLE_OAUTH_PROFILE_URL || 'https://openidconnect.googleapis.com/v1/userinfo',
        clientId,
        clientSecret,
        scope: 'openid email profile',
        extractEmail: (profile: any) => profile.email as string,
      };
    }

    if (lower === 'facebook') {
      const clientId = process.env.FACEBOOK_CLIENT_ID || '';
      const clientSecret = process.env.FACEBOOK_CLIENT_SECRET || '';
      if (!clientId || !clientSecret) {
        throw new BadRequestException('Facebook OAuth is not configured.');
      }
      return {
        authUrl: process.env.FACEBOOK_OAUTH_AUTH_URL || 'https://www.facebook.com/v12.0/dialog/oauth',
        tokenUrl: process.env.FACEBOOK_OAUTH_TOKEN_URL || 'https://graph.facebook.com/v12.0/oauth/access_token',
        profileUrl:
          process.env.FACEBOOK_OAUTH_PROFILE_URL ||
          'https://graph.facebook.com/me?fields=id,name,email',
        clientId,
        clientSecret,
        scope: 'email',
        extractEmail: (profile: any) => profile.email as string,
      };
    }

    throw new BadRequestException('Unsupported OAuth provider');
  }

  private getOAuthRedirectUri(provider: string): string {
    const domain = process.env.DOMAIN;
    if (!domain) {
      throw new BadRequestException('DOMAIN is not configured for OAuth.');
    }
    return `https://${domain}/auth/oauth/callback/${encodeURIComponent(provider)}`;
  }
}

