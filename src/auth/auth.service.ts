/**
 * Auth Service
 */

import { Injectable, UnauthorizedException, ConflictException, BadRequestException, NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { verifyAuthToken } from './jwt-verifier';
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
import { EmailChangeRequestDto } from './dto/email-change-request.dto';
import { ContactRegisterDto } from './dto/contact-register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { LoggerService } from '../../shared/logger/logger.service';
import { User } from '../users/entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { MagicLinkToken } from './entities/magic-link-token.entity';
import { EmailChangeToken } from './entities/email-change-token.entity';
import { AuthEventPublisher } from '../events/auth-event-publisher.service';
import { MarketingConsentService } from '../users/marketing-consent.service';

/**
 * The version of the consent text shown beside the checkbox. Bump it whenever the wording
 * changes: MarketingConsentService revokes the old evidence and records fresh evidence, so the
 * history shows exactly which sentence each person agreed to.
 */
export const BAZOS_MARKETING_CONSENT_VERSION = 'bazos-marketing-2026-07-22';
import { LegacyIdentityMapping } from '../users/entities/legacy-identity-mapping.entity';
import { MagicLinkRequestDto } from './dto/magic-link-request.dto';
import { MagicLinkVerifyDto } from './dto/magic-link-verify.dto';
import { ContactCodeRequestDto } from './dto/contact-code-request.dto';
import { resolvePasswordRecoveryTtlMinutes } from './password-recovery-ttl';
import { ContactCodeVerifyDto } from './dto/contact-code-verify.dto';
import { UpdateUserMarketingPreferencesDto } from './dto/update-user-marketing-preferences.dto';
import { CreateDeliveryAddressDto, UpdateDeliveryAddressDto } from './dto/delivery-address.dto';
import { CreateInvoiceProfileDto, UpdateInvoiceProfileDto } from './dto/invoice-profile.dto';
import { Response } from 'express';
import { UserDeliveryAddress } from '../users/entities/user-delivery-address.entity';
import { UserInvoiceProfile } from '../users/entities/user-invoice-profile.entity';
import { requireJwtSecret } from './jwt-secret';

const AUTH_CHECKOUT_DATA_SCHEMA_VERSION = 'auth.customer-data-wallet.checkout-data.v1';

/**
 * Lifetime of a session minted by `createSessionForUser` (the internal SSO handoff).
 *
 * Deliberately far shorter than `JWT_EXPIRES_IN` (7d) and not configurable by
 * environment: this session is established from a token in a URL rather than from the
 * user authenticating to us, so its blast radius should not drift upward by config.
 */
const INTERNAL_SESSION_EXPIRES_IN = '12h';
const INTERNAL_SESSION_SECONDS = 12 * 60 * 60;

@Injectable()
export class AuthService {
  private readonly notificationsServiceUrl: string;
  private readonly notificationServiceToken: string;
  private readonly magicLinkTtlMinutes: number;
  private readonly passwordRecoveryTtlMinutes: number;
  private readonly magicLinkRateLimitPerIp: number;
  private readonly magicLinkRateLimitPerEmail: number;
  private readonly oauthInitRateLimitPerIp: number;
  private readonly rateLimitWindowMs: number;
  private readonly contactCodeEmailChannelKey: string;
  private readonly contactCodePhoneChannelKey: string;
  private readonly contactCodePhoneChannel: 'whatsapp' | 'telegram' | 'sms';
  private readonly allowedRedirectOrigins: string[];
  private readonly oauthStateStore = new Map<
    string,
    {
      provider: string;
      returnUrl: string;
      clientId?: string;
      appState?: string;
      createdAt: number;
    }
  >();
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
    @InjectRepository(EmailChangeToken)
    private readonly emailChangeTokenRepository: Repository<EmailChangeToken>,
    @InjectRepository(LegacyIdentityMapping)
    private readonly legacyIdentityMappingRepository: Repository<LegacyIdentityMapping>,
    private readonly authEvents: AuthEventPublisher,
    private readonly marketingConsent: MarketingConsentService,
  ) {
    this.notificationsServiceUrl = process.env.NOTIFICATION_SERVICE_URL || '';
    if (!this.notificationsServiceUrl) {
      this.logger.warn('NOTIFICATION_SERVICE_URL is not set. Email notifications will not work.', 'AuthService');
    }
    this.notificationServiceToken = process.env.NOTIFICATION_SERVICE_TOKEN || '';
    if (!this.notificationServiceToken) {
      this.logger.warn('NOTIFICATION_SERVICE_TOKEN is not set. Notification requests will be rejected with 401.', 'AuthService');
    }

    this.magicLinkTtlMinutes = Number(process.env.AUTH_MAGIC_LINK_TTL_MINUTES || '15');
    this.passwordRecoveryTtlMinutes = resolvePasswordRecoveryTtlMinutes();
    this.magicLinkRateLimitPerIp = Number(process.env.AUTH_MAGIC_LINK_RATE_LIMIT_PER_IP || '20');
    this.magicLinkRateLimitPerEmail = Number(process.env.AUTH_MAGIC_LINK_RATE_LIMIT_PER_EMAIL || '10');
    this.oauthInitRateLimitPerIp = Number(process.env.AUTH_OAUTH_INIT_RATE_LIMIT_PER_IP || '60');
    this.rateLimitWindowMs = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || String(15 * 60 * 1000));
    this.contactCodeEmailChannelKey = process.env.AUTH_CONTACT_CODE_EMAIL_CHANNEL_KEY || '';
    this.contactCodePhoneChannelKey = process.env.AUTH_CONTACT_CODE_PHONE_CHANNEL_KEY || '';
    this.contactCodePhoneChannel = this.resolveContactCodePhoneChannel(process.env.AUTH_CONTACT_CODE_PHONE_CHANNEL);
    const originsEnv = process.env.AUTH_ALLOWED_REDIRECT_ORIGINS || '';
    this.allowedRedirectOrigins = originsEnv
      .split(',')
      .map((o) => o.trim())
      .filter((o) => o.length > 0);
  }

  private audit(level: 'info' | 'warn' | 'error', operation: string, outcome: string, details: Record<string, string | number | boolean | undefined | null> = {}, trace?: string): void {
    const fields: Record<string, string | number | boolean | undefined | null> = {
      service: 'auth-microservice',
      operation,
      outcome,
      ...details,
    };
    const message = Object.entries(fields)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => `${key}=${String(value).replace(/\s+/g, '_')}`)
      .join(' ');

    if (operation === 'validate_token' && outcome === 'success') {
      return;
    }

    if (level === 'error') {
      this.logger.error(message, trace, 'AuthAudit');
    } else if (level === 'warn') {
      this.logger.warn(message, 'AuthAudit');
    } else {
      this.logger.log(message, 'AuthAudit');
    }
  }

  async register(registerDto: RegisterDto, context: { ip?: string | null; userAgent?: string | null } = {}) {
    const startedAt = Date.now();
    // Check if user already exists
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      this.audit('warn', 'register', 'failure', {
        identifier: registerDto.email,
        reason: 'email_exists',
        duration_ms: Date.now() - startedAt,
      });
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
    const tokens = await this.generateTokens(user.id, 'password', registerDto.client_id, registerDto.return_url);

    this.audit('info', 'register', 'success', {
      identifier: user.email,
      user_id: user.id,
      auth_method: 'password',
      duration_ms: Date.now() - startedAt,
    });

    // Only on an explicit true. Absent and false both mean "do not send anything": consent must
    // be an active choice, so anything short of one is a refusal rather than a default.
    if (registerDto.marketing_consent === true) {
      await this.recordMarketingConsent(user.id, context);
    }

    // Proven identity: the person set a credential. Never awaited into the failure path — the
    // publisher swallows its own errors, and registration must not depend on a broker.
    await this.emitRegistration({
      userId: user.id,
      registrationMethod: 'password',
      email: user.email,
      phone: user.phone,
      correlationId: registerDto.state,
      applicationContext: registerDto.client_id,
    });

    return {
      user: this.sanitizeUser(user),
      ...tokens,
    };
  }

  async login(loginDto: LoginDto) {
    const startedAt = Date.now();
    const identifier = this.normalizeIdentifier(loginDto.identifier || loginDto.email);
    const isEmailIdentifier = this.isEmailIdentifier(identifier);
    const lookupIdentifier = isEmailIdentifier ? this.normalizeEmail(identifier) : this.normalizePhone(identifier);

    try {
      if (!lookupIdentifier || !loginDto.password) {
        this.audit('warn', 'login', 'failure', {
          identifier,
          reason: 'missing_credentials',
          duration_ms: Date.now() - startedAt,
        });
        throw new UnauthorizedException('Invalid credentials');
      }

      let user = isEmailIdentifier ? await this.usersService.findByEmail(lookupIdentifier) : await this.usersService.findByPhone(lookupIdentifier);
      let authenticatedVia = 'password';

      if (user) {
        const isBcryptPassword = Boolean(user.password && /^\$2[aby]\$\d{2}\$.+/.test(user.password));
        if (isBcryptPassword) {
          try {
            const isPasswordValid = await bcryptjs.compare(loginDto.password, user.password);
            if (!isPasswordValid) {
              user = isEmailIdentifier ? await this.tryLegacyPasswordLogin(lookupIdentifier, loginDto.password) : null;
              authenticatedVia = 'legacy_password';
            }
          } catch (err) {
            this.audit('warn', 'login', 'password_check_error', {
              identifier: lookupIdentifier,
              reason: (err as Error).message,
              duration_ms: Date.now() - startedAt,
            });
            user = isEmailIdentifier ? await this.tryLegacyPasswordLogin(lookupIdentifier, loginDto.password) : null;
            authenticatedVia = 'legacy_password';
          }
        } else {
          user = isEmailIdentifier ? await this.tryLegacyPasswordLogin(lookupIdentifier, loginDto.password) : null;
          authenticatedVia = 'legacy_password';
        }
      } else {
        user = isEmailIdentifier ? await this.tryLegacyPasswordLogin(lookupIdentifier, loginDto.password) : null;
        authenticatedVia = 'legacy_password';
      }

      if (!user) {
        this.audit('warn', 'login', 'failure', {
          identifier: lookupIdentifier,
          reason: 'invalid_credentials',
          duration_ms: Date.now() - startedAt,
        });
        throw new UnauthorizedException('Invalid credentials');
      }

      if (!user.isActive) {
        this.audit('warn', 'login', 'failure', {
          identifier: lookupIdentifier,
          user_id: user.id,
          reason: 'inactive_user',
          duration_ms: Date.now() - startedAt,
        });
        throw new UnauthorizedException('User account is inactive');
      }

      const tokens = await this.generateTokens(user.id, authenticatedVia, loginDto.client_id, loginDto.return_url);
      this.audit('info', 'login', 'success', {
        identifier: user.email || user.phone || lookupIdentifier,
        user_id: user.id,
        auth_method: authenticatedVia,
        duration_ms: Date.now() - startedAt,
      });
      return {
        user: this.sanitizeUser(user),
        ...tokens,
      };
    } catch (err) {
      if (err instanceof UnauthorizedException || err instanceof BadRequestException) throw err;
      this.audit(
        'error',
        'login',
        'failure',
        {
          identifier: lookupIdentifier,
          reason: (err as Error).message,
          duration_ms: Date.now() - startedAt,
        },
        (err as Error).stack,
      );
      throw new UnauthorizedException('Invalid credentials');
    }
  }

  async validateToken(token: string) {
    const startedAt = Date.now();
    try {
      // TASK-KEY-F3 step 3: accepts RS256 (this service's own key) and HS256 (tokens
      // minted before the flip). 15 services delegate to POST /auth/validate rather than
      // verifying locally, so this single call decides whether they can authenticate.
      const payload = await verifyAuthToken(token);

      if (!this.isUuid(payload.sub)) {
        this.audit('warn', 'validate_token', 'failure', {
          reason: 'invalid_subject',
          duration_ms: Date.now() - startedAt,
        });
        throw new UnauthorizedException('Invalid token');
      }

      const user = await this.usersService.findById(payload.sub);
      if (!user || !user.isActive) {
        this.audit('warn', 'validate_token', 'failure', {
          user_id: payload.sub,
          reason: 'user_not_found_or_inactive',
          duration_ms: Date.now() - startedAt,
        });
        throw new UnauthorizedException('Invalid token');
      }

      // Get user roles
      const roles = await this.rolesService.getUserRoles(user.id);

      this.audit('info', 'validate_token', 'success', {
        identifier: user.email,
        user_id: user.id,
        role_count: roles.length,
        duration_ms: Date.now() - startedAt,
      });

      const sanitizedUser = this.sanitizeUser(user);
      return {
        ...sanitizedUser,
        ...this.resolveServiceIdentity(user),
        roles,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      this.audit(
        'error',
        'validate_token',
        'failure',
        {
          reason: error.message,
          duration_ms: Date.now() - startedAt,
        },
        error.stack,
      );
      throw new UnauthorizedException('Invalid token');
    }
  }

  private isUuid(value: unknown): value is string {
    return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }

  private normalizeClientId(clientId?: string | null): string | undefined {
    const normalized = (clientId || '').trim().toLowerCase();
    if (!normalized) {
      return undefined;
    }
    if (!/^[a-z0-9][a-z0-9._-]{0,99}$/.test(normalized)) {
      throw new BadRequestException('Invalid client_id');
    }
    return normalized;
  }

  async refreshToken(refreshToken: string) {
    const startedAt = Date.now();
    try {
      // Refresh tokens live 30 days, so HS256 ones stay in flight well past the RS256
      // flip. Dual verification is what makes the migration non-breaking for them.
      const payload = await verifyAuthToken(refreshToken);

      const user = await this.usersService.findById(payload.sub);
      if (!user || !user.isActive) {
        this.audit('warn', 'refresh_token', 'failure', {
          user_id: payload.sub,
          reason: 'user_not_found_or_inactive',
          duration_ms: Date.now() - startedAt,
        });
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Generate new tokens
      const tokens = await this.generateTokens(user.id, (payload as any).auth_method || 'password');

      this.audit('info', 'refresh_token', 'success', {
        identifier: user.email,
        user_id: user.id,
        auth_method: (payload as any).auth_method || 'password',
        duration_ms: Date.now() - startedAt,
      });

      return {
        user: this.sanitizeUser(user),
        ...tokens,
      };
    } catch (error) {
      this.audit(
        'error',
        'refresh_token',
        'failure',
        {
          reason: error.message,
          duration_ms: Date.now() - startedAt,
        },
        error.stack,
      );
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

  async getProfile(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid token');
    }

    return this.sanitizeUser(user);
  }

  private normalizeIdentifier(identifier?: string): string {
    return (identifier || '').trim();
  }

  private isEmailIdentifier(identifier: string): boolean {
    return identifier.includes('@');
  }

  private normalizeEmail(email?: string): string {
    return (email || '').trim().toLowerCase();
  }

  private normalizePhone(phone?: string): string {
    return (phone || '').trim().replace(/[^0-9+]/g, '');
  }

  private normalizeContactValue(type: string, value?: string): string {
    if (type === 'email') {
      return this.normalizeEmail(value);
    }
    if (type === 'phone') {
      return this.normalizePhone(value);
    }
    return (value || '').trim();
  }

  private normalizeContactInfo(
    contacts: Array<{
      type: string;
      value: string;
      isPrimary?: boolean | string;
    }>,
  ): Array<{ type: string; value: string; isPrimary?: boolean }> {
    return contacts
      .map((contact) => {
        const type = (contact.type || '').trim().toLowerCase();
        const value = this.normalizeContactValue(type, contact.value);
        const isPrimary = contact.isPrimary === true || contact.isPrimary === 'true' || contact.isPrimary === '1';
        return { type, value, isPrimary };
      })
      .filter((contact) => Boolean(contact.type && contact.value));
  }

  private findPrimaryContact(contacts: Array<{ type: string; value: string; isPrimary?: boolean }>, type: 'email' | 'phone'): { type: string; value: string; isPrimary?: boolean } | undefined {
    return contacts.find((contact) => contact.type === type && contact.isPrimary) || contacts.find((contact) => contact.type === type);
  }

  private contactsMatch(leftType: string, leftValue: string, rightType: string, rightValue: string): boolean {
    if (leftType !== rightType) {
      return false;
    }
    return this.normalizeContactValue(leftType, leftValue) === this.normalizeContactValue(rightType, rightValue);
  }

  private mergeProvisioningSource(preferences: Record<string, unknown> | null | undefined, source?: string, sessionId?: string): Record<string, unknown> | null {
    const normalizedSource = (source || '').trim();
    if (!normalizedSource) {
      return preferences || null;
    }

    const current = preferences && typeof preferences === 'object' && !Array.isArray(preferences) ? { ...preferences } : {};
    const currentSources = current.authSources && typeof current.authSources === 'object' && !Array.isArray(current.authSources) ? { ...(current.authSources as Record<string, unknown>) } : {};

    currentSources[normalizedSource] = {
      source: normalizedSource,
      provisioned: true,
      sessionId: sessionId || null,
    };
    current.authSources = currentSources;
    return current;
  }

  private async tryLegacyPasswordLogin(email: string, password: string): Promise<User | null> {
    const normalizedEmail = (email || '').trim().toLowerCase();
    if (!normalizedEmail || !password) {
      return null;
    }

    const mappings = await this.legacyIdentityMappingRepository
      .createQueryBuilder('mapping')
      .addSelect('mapping.legacyPasswordHash')
      .where('mapping.legacySystem = :legacySystem', {
        legacySystem: 'speakasap-portal',
      })
      .andWhere('mapping.normalizedEmail = :normalizedEmail', {
        normalizedEmail,
      })
      .andWhere('mapping.authUserId IS NOT NULL')
      .orderBy('mapping.legacyUserId', 'ASC')
      .getMany();

    for (const mapping of mappings) {
      const user = await this.usersService.findById(mapping.authUserId);
      if (!user || !user.isActive) {
        continue;
      }

      if (user.password && /^\$2[aby]\$\d{2}\$.+/.test(user.password)) {
        try {
          if (await bcryptjs.compare(password, user.password)) {
            return user;
          }
        } catch {
          continue;
        }
      }

      if (mapping.legacyPasswordHash && this.verifyDjangoPassword(password, mapping.legacyPasswordHash)) {
        const hashedPassword = await bcrypt.hash(password, 10);
        await this.usersService.updatePassword(user.id, hashedPassword);
        await this.legacyIdentityMappingRepository.update(mapping.id, {
          legacyPasswordHash: null,
          legacyPasswordMigratedAt: new Date(),
        });
        return this.usersService.findById(user.id);
      }
    }

    return null;
  }

  private verifyDjangoPassword(password: string, encoded: string): boolean {
    if (!encoded || encoded.startsWith('!')) {
      return false;
    }
    const parts = encoded.split('$');
    if (parts.length !== 4 || parts[0] !== 'pbkdf2_sha256') {
      return false;
    }
    const iterations = Number(parts[1]);
    const salt = parts[2];
    const expected = Buffer.from(parts[3], 'base64');
    if (!Number.isFinite(iterations) || iterations <= 0 || !salt || expected.length === 0) {
      return false;
    }
    const actual = crypto.pbkdf2Sync(password, salt, iterations, expected.length, 'sha256');
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  }

  /**
   * Emits `auth.user.registered.v1` without ever letting the attempt reach the caller.
   *
   * `AuthEventPublisher` already swallows its own failures, so this looks redundant — it is not.
   * It stops the registration path from *depending* on that guarantee: the day someone makes the
   * publisher throw, the failure should be a missing analytics event, not every application in
   * the ecosystem unable to sign anyone up. The blast radius of this service is the reason.
   */
  /**
   * Stores the marketing consent as evidence.
   *
   * Never allowed to fail a registration: someone who ticked a box and got an error would be
   * refused an account over a mailing list. The consent is lost in that case, not silently
   * assumed — losing it means we do not email them, which is the safe direction.
   */
  private async recordMarketingConsent(
    userId: string,
    context: { ip?: string | null; userAgent?: string | null },
  ) {
    try {
      await this.marketingConsent.grant(
        userId,
        'bazos',
        BAZOS_MARKETING_CONSENT_VERSION,
        context.ip ?? null,
        context.userAgent ?? null,
      );
    } catch (err) {
      this.logger.error(
        `Marketing consent not recorded for user ${userId}: ${(err as Error).message}`,
        (err as Error).stack,
        'AuthService',
      );
    }
  }

  private async emitRegistration(input: Parameters<AuthEventPublisher['publishUserRegistered']>[0]) {
    try {
      await this.authEvents.publishUserRegistered(input);
    } catch (err) {
      this.logger.error(
        `Registration event failed for user ${input.userId}: ${(err as Error).message}`,
        (err as Error).stack,
        'AuthService',
      );
    }
  }

  private async generateTokens(userId: string, authMethod: string, clientId?: string | null, returnUrl?: string | null) {
    const normalizedClientId = this.normalizeClientId(clientId);
    if (normalizedClientId) {
      await this.rolesService.assignDefaultApplicationAccess(userId, normalizedClientId, userId, returnUrl || undefined);
    }

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

  /**
   * Mint a session for a user whose identity has already been established out of band.
   *
   * Built for the speakasap portal SSO handoff: the portal signs a short-lived token,
   * the platform verifies it and calls `resolve-or-provision-legacy` to learn *who* the
   * student is, and this turns that answer into a session. Internal callers only — the
   * route is behind `InternalServiceGuard`.
   *
   * Two deliberate differences from `generateTokens`, both narrowing:
   *
   * - **No refresh token.** The caller established this session from a link in a URL,
   *   not from the user proving anything to us. Handing back a 30-day credential on that
   *   basis widens a redirect into long-lived access.
   * - **12 hours, not 7 days.** Long enough for a study session, short enough that a
   *   leaked handoff does not become a standing login.
   *
   * `authMethod` lands in the token as `auth_method`, so these sessions are
   * distinguishable from password logins in any later audit.
   */
  async createSessionForUser(
    userId: string,
    authMethod = 'portal_sso',
  ): Promise<{ accessToken: string; expiresIn: number; userId: string }> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      // Never sign a token for a user we cannot read. A missing user here means the
      // caller resolved an identity that no longer exists.
      this.audit('warn', 'internal_create_session', 'unknown_user', { user_id: userId });
      throw new NotFoundException('User not found');
    }

    const roles = await this.rolesService.getUserRoles(userId);

    const payload: Record<string, unknown> = {
      sub: userId,
      email: user.email,
      type: user.userType || 'end_user',
      roles,
      auth_method: authMethod,
    };

    const accessToken = this.jwtService.sign(payload, {
      expiresIn: INTERNAL_SESSION_EXPIRES_IN,
    });

    this.audit('info', 'internal_create_session', 'success', {
      user_id: userId,
      auth_method: authMethod,
      expires_in: INTERNAL_SESSION_SECONDS,
    });

    return { accessToken, expiresIn: INTERNAL_SESSION_SECONDS, userId };
  }

  async requestPasswordReset(passwordResetRequestDto: PasswordResetRequestDto) {
    const startedAt = Date.now();
    const user = await this.usersService.findByEmail(passwordResetRequestDto.email);
    if (!user) {
      // Don't reveal if user exists or not for security
      this.audit('warn', 'password_reset_request', 'accepted_unknown_user', {
        identifier: passwordResetRequestDto.email,
        duration_ms: Date.now() - startedAt,
      });
      return {
        message: 'If the email exists, a password reset link has been sent.',
      };
    }

    let validatedReturnUrl: string | null = null;
    if (passwordResetRequestDto.return_url) {
      try {
        validatedReturnUrl = this.validateReturnUrl(passwordResetRequestDto.return_url);
      } catch {
        // Ignore an invalid return_url - don't fail the reset request over it.
      }
    }

    // Both recovery entry points mint the same grant, so they cannot drift apart.
    const token = await this.mintPasswordRecoveryGrant(user.id, {
      returnUrl: validatedReturnUrl,
      clientId: passwordResetRequestDto.client_id || null,
      state: passwordResetRequestDto.state || null,
    });

    // Send password reset email via notifications-microservice
    const frontendUrl = process.env.FRONTEND_URL;
    if (!frontendUrl) {
      this.audit('error', 'password_reset_request', 'failure', {
        identifier: user.email,
        user_id: user.id,
        reason: 'frontend_url_not_configured',
        duration_ms: Date.now() - startedAt,
      });
      throw new BadRequestException('Frontend URL is not configured');
    }
    const resetUrlParams = new URLSearchParams({ token });
    if (validatedReturnUrl) {
      resetUrlParams.set('return_url', validatedReturnUrl);
    }
    if (passwordResetRequestDto.client_id) {
      resetUrlParams.set('client_id', passwordResetRequestDto.client_id);
    }
    if (passwordResetRequestDto.state) {
      resetUrlParams.set('state', passwordResetRequestDto.state);
    }
    const lang = this.normalizeAuthLang(passwordResetRequestDto.lang);
    resetUrlParams.set('lang', lang);
    resetUrlParams.set('ttl', String(this.passwordRecoveryTtlMinutes));
    const resetUrl = `${frontendUrl}/reset-password?${resetUrlParams.toString()}`;
    const fromDomain = this.normalizeEmailDisplayDomain(process.env.DOMAIN || '');
    const resetTtlMinutes = this.passwordRecoveryTtlMinutes;
    const resetCopy = this.getAuthEmailCopy('password_reset', lang, resetTtlMinutes);
    try {
      await firstValueFrom(
        this.httpService.post(
          `${this.notificationsServiceUrl}/notifications/send`,
          {
            channel: 'email',
            type: 'custom',
            recipient: user.email,
            subject: resetCopy.subject,
            message: this.buildAuthEmailHtml(resetUrl, fromDomain, resetCopy, lang),
            contentType: 'text/html',
            fromName: fromDomain,
          },
          {
            headers: {
              Authorization: `Bearer ${this.notificationServiceToken}`,
            },
          },
        ),
      );
      this.audit('info', 'password_reset_request', 'email_sent', {
        identifier: user.email,
        user_id: user.id,
        duration_ms: Date.now() - startedAt,
      });
    } catch (error) {
      this.audit(
        'error',
        'password_reset_request',
        'email_send_failed',
        {
          identifier: user.email,
          user_id: user.id,
          reason: error.message,
          duration_ms: Date.now() - startedAt,
        },
        error.stack,
      );
      // Continue even if email fails - token is still generated
    }

    return {
      message: 'If the email exists, a password reset link has been sent.',
    };
  }

  async confirmPasswordReset(passwordResetConfirmDto: PasswordResetConfirmDto) {
    const startedAt = Date.now();
    const resetToken = await this.passwordResetTokenRepository.findOne({
      where: { token: passwordResetConfirmDto.token, used: false },
      relations: ['user'],
    });

    if (!resetToken) {
      this.audit('warn', 'password_reset_confirm', 'failure', {
        reason: 'invalid_or_used_token',
        duration_ms: Date.now() - startedAt,
      });
      throw new BadRequestException('Invalid or expired reset token');
    }

    if (new Date() > resetToken.expiresAt) {
      this.audit('warn', 'password_reset_confirm', 'failure', {
        user_id: resetToken.userId,
        reason: 'expired_token',
        duration_ms: Date.now() - startedAt,
      });
      throw new BadRequestException('Reset token has expired');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(passwordResetConfirmDto.newPassword, 10);

    // Update user password
    await this.usersService.updatePassword(resetToken.userId, hashedPassword);

    // Mark token as used
    resetToken.used = true;
    await this.passwordResetTokenRepository.save(resetToken);

    this.audit('info', 'password_reset_confirm', 'success', {
      user_id: resetToken.userId,
      duration_ms: Date.now() - startedAt,
    });

    if (!resetToken.returnUrl) {
      return { message: 'Password reset successfully' };
    }

    // The password write and the grant burn are already committed. Signing the user straight
    // into the app is a convenience on top of that, so a failure here must not be reported as
    // a failed reset - the new password is live either way, and saying otherwise sends the
    // user back to recover a password that already works.
    try {
      // Re-validate at handoff, not only at mint: the allowlist may have changed since, and a
      // grant row is long-lived relative to a config reload.
      const finalReturnUrl = this.validateReturnUrl(resetToken.returnUrl);
      const tokens = await this.generateTokens(
        resetToken.userId,
        'password_recovery',
        resetToken.clientId,
        finalReturnUrl,
      );
      const user = await this.usersService.findById(resetToken.userId);

      return {
        message: 'Password reset successfully',
        user: this.sanitizeUser(user),
        ...tokens,
        redirectUrl: this.buildTokenHandoffUrl(
          finalReturnUrl,
          tokens,
          'password_recovery',
          resetToken.state || undefined,
        ),
      };
    } catch (error) {
      this.audit('warn', 'password_reset_confirm', 'handoff_failed', {
        user_id: resetToken.userId,
        client_id: resetToken.clientId,
        reason: (error as Error).message,
        duration_ms: Date.now() - startedAt,
      });
      return { message: 'Password reset successfully' };
    }
  }

  async changePassword(userId: string, passwordChangeDto: PasswordChangeDto) {
    const startedAt = Date.now();
    const user = await this.usersService.findById(userId);
    if (!user || !user.password) {
      this.audit('warn', 'password_change', 'failure', {
        user_id: userId,
        reason: 'user_not_found_or_password_not_set',
        duration_ms: Date.now() - startedAt,
      });
      throw new NotFoundException('User not found or password not set');
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(passwordChangeDto.currentPassword, user.password);
    if (!isPasswordValid) {
      this.audit('warn', 'password_change', 'failure', {
        identifier: user.email,
        user_id: user.id,
        reason: 'current_password_invalid',
        duration_ms: Date.now() - startedAt,
      });
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(passwordChangeDto.newPassword, 10);

    // Update password
    await this.usersService.updatePassword(userId, hashedPassword);

    this.audit('info', 'password_change', 'success', {
      identifier: user.email,
      user_id: user.id,
      duration_ms: Date.now() - startedAt,
    });

    return { message: 'Password changed successfully' };
  }

  async requestEmailChange(userId: string, dto: EmailChangeRequestDto) {
    const startedAt = Date.now();
    const user = await this.usersService.findById(userId);
    if (!user || !user.isActive) {
      this.audit('warn', 'email_change_request', 'failure', {
        user_id: userId,
        reason: 'user_not_found_or_inactive',
        duration_ms: Date.now() - startedAt,
      });
      throw new UnauthorizedException('Invalid token');
    }

    const newEmail = this.normalizeEmail(dto.newEmail);
    if (!newEmail || !this.isEmailIdentifier(newEmail)) {
      throw new BadRequestException('A valid new email is required');
    }

    const currentEmail = this.normalizeEmail(user.email);
    if (currentEmail && newEmail === currentEmail) {
      throw new BadRequestException('New email must be different from current email');
    }

    const existing = await this.usersService.findByEmail(newEmail);
    if (existing && existing.id !== userId) {
      this.audit('warn', 'email_change_request', 'failure', {
        user_id: userId,
        reason: 'email_exists',
        duration_ms: Date.now() - startedAt,
      });
      throw new ConflictException('Email is already in use');
    }

    if (user.password) {
      if (!dto.currentPassword) {
        throw new UnauthorizedException('Current password is required');
      }
      const isPasswordValid = await bcrypt.compare(dto.currentPassword, user.password);
      if (!isPasswordValid) {
        this.audit('warn', 'email_change_request', 'failure', {
          user_id: userId,
          reason: 'current_password_invalid',
          duration_ms: Date.now() - startedAt,
        });
        throw new UnauthorizedException('Current password is incorrect');
      }
    }

    const token = crypto.randomBytes(32).toString('hex');
    const ttlMinutes = Number(process.env.AUTH_EMAIL_CHANGE_TTL_MINUTES || '60');
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
    const returnUrl = dto.return_url ? this.validateReturnUrl(dto.return_url) : null;
    const emailChangeToken = this.emailChangeTokenRepository.create({
      userId,
      token,
      oldEmail: currentEmail || null,
      newEmail,
      returnUrl,
      expiresAt,
      used: false,
    });
    await this.emailChangeTokenRepository.save(emailChangeToken);

    const baseUrl = this.resolvePublicBaseUrl();
    const verifyUrl = `${baseUrl}/auth/email-change-confirm?token=${encodeURIComponent(token)}`;
    const lang = this.normalizeAuthLang(dto.lang);
    if (this.notificationsServiceUrl) {
      try {
        const emailChangeCopy = this.getPlainEmailCopy('email_change', lang, ttlMinutes, verifyUrl);
        await firstValueFrom(
          this.httpService.post(
            `${this.notificationsServiceUrl}/notifications/send`,
            {
              channel: 'email',
              type: 'custom',
              recipient: newEmail,
              subject: emailChangeCopy.subject,
              message: emailChangeCopy.message,
            },
            {
              headers: {
                Authorization: `Bearer ${this.notificationServiceToken}`,
              },
            },
          ),
        );
      } catch (error) {
        this.audit('error', 'email_change_request', 'email_send_failed', {
          user_id: userId,
          reason: (error as Error).message,
          duration_ms: Date.now() - startedAt,
        }, (error as Error).stack);
      }
    }

    this.audit('info', 'email_change_request', 'created', {
      user_id: userId,
      duration_ms: Date.now() - startedAt,
    });

    return { message: 'If the new email can be used, a confirmation link has been sent.' };
  }

  async confirmEmailChange(tokenValue: string) {
    const startedAt = Date.now();
    if (!tokenValue || typeof tokenValue !== 'string') {
      throw new BadRequestException('Email change token is required');
    }

    const token = await this.emailChangeTokenRepository.findOne({
      where: { token: tokenValue, used: false },
      relations: ['user'],
    });

    if (!token || new Date() > token.expiresAt) {
      this.audit('warn', 'email_change_confirm', 'failure', {
        reason: token ? 'expired_token' : 'invalid_or_used_token',
        duration_ms: Date.now() - startedAt,
      });
      throw new BadRequestException('Invalid or expired email change token');
    }

    const user = await this.usersService.findById(token.userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid token');
    }

    const existing = await this.usersService.findByEmail(token.newEmail);
    if (existing && existing.id !== token.userId) {
      throw new ConflictException('Email is already in use');
    }

    const nextContacts = this.upsertPrimaryContact(user.contactInfo || [], {
      type: 'email',
      value: token.newEmail,
      isPrimary: true,
    });
    await this.usersService.update(token.userId, {
      ...user,
      email: token.newEmail,
      contactInfo: nextContacts,
      isVerified: true,
      lastActivity: new Date(),
    } as User);

    token.used = true;
    await this.emailChangeTokenRepository.save(token);
    const updatedUser = await this.usersService.findById(token.userId);
    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    this.audit('info', 'email_change_confirm', 'success', {
      user_id: token.userId,
      duration_ms: Date.now() - startedAt,
    });

    return {
      message: 'Email changed successfully. Sign in again or refresh your token so other applications receive the updated email claim.',
      user: this.sanitizeUser(updatedUser),
      returnUrl: token.returnUrl || null,
    };
  }

  private resolvePublicBaseUrl(): string {
    const domain = process.env.DOMAIN;
    const baseUrl = domain ? `https://${domain}` : process.env.FRONTEND_URL;
    if (!baseUrl) {
      throw new BadRequestException('Public Auth URL is not configured');
    }
    return baseUrl.replace(/\/+$/, '');
  }

  async setInitialPassword(userId: string, newPassword: string) {
    const startedAt = Date.now();
    const user = await this.usersService.findById(userId);
    if (!user) {
      this.audit('warn', 'password_set', 'failure', {
        user_id: userId,
        reason: 'user_not_found',
        duration_ms: Date.now() - startedAt,
      });
      throw new NotFoundException('User not found');
    }
    if (user.password) {
      this.audit('warn', 'password_set', 'failure', {
        identifier: user.email,
        user_id: user.id,
        reason: 'password_already_set',
        duration_ms: Date.now() - startedAt,
      });
      throw new BadRequestException('Password already set — use change password instead');
    }
    if (!newPassword || newPassword.length < 6) {
      this.audit('warn', 'password_set', 'failure', {
        identifier: user.email,
        user_id: user.id,
        reason: 'password_too_short',
        duration_ms: Date.now() - startedAt,
      });
      throw new BadRequestException('Password must be at least 6 characters');
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.usersService.updatePassword(userId, hashedPassword);
    this.audit('info', 'password_set', 'success', {
      identifier: user.email,
      user_id: user.id,
      duration_ms: Date.now() - startedAt,
    });
    return { message: 'Password set successfully' };
  }

  async registerContact(contactRegisterDto: ContactRegisterDto) {
    const normalizedContacts = this.normalizeContactInfo(contactRegisterDto.contactInfo || []);
    if (normalizedContacts.length === 0) {
      throw new BadRequestException('At least one contact is required');
    }

    // Check if user already exists by contact info. This remains provisioning only.
    let existingUser: User | null = null;
    for (const contact of normalizedContacts) {
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
      // Update existing user - add new contact info if not present.
      const existingContacts = this.normalizeContactInfo(existingUser.contactInfo || []);
      const newContacts = [...existingContacts];

      for (const newContact of normalizedContacts) {
        const contactExists = existingContacts.some((contact) => this.contactsMatch(contact.type, contact.value, newContact.type, newContact.value));
        if (!contactExists) {
          newContacts.push(newContact);
        }
      }

      const primaryEmail = this.findPrimaryContact(newContacts, 'email');
      const primaryPhone = this.findPrimaryContact(newContacts, 'phone');
      existingUser.contactInfo = newContacts;
      existingUser.email = existingUser.email || primaryEmail?.value || null;
      existingUser.phone = existingUser.phone || primaryPhone?.value || null;
      existingUser.name = contactRegisterDto.name || existingUser.name;
      existingUser.lastActivity = new Date();
      existingUser.source = existingUser.source || contactRegisterDto.source;
      existingUser.perApplicationPreferences = this.mergeProvisioningSource(existingUser.perApplicationPreferences, contactRegisterDto.source, contactRegisterDto.sessionId);
      existingUser.sessionId = contactRegisterDto.sessionId || existingUser.sessionId;

      const updatedUser = await this.usersService.update(existingUser.id, existingUser);

      // Legacy field retained for compatibility. It is not a JWT and must not be treated as authentication.
      const sessionToken = crypto.randomBytes(32).toString('hex');

      this.logger.log(`Contact-based user provisioned: ${updatedUser.id}`, 'AuthService');

      return {
        success: true,
        userId: updatedUser.id,
        sessionId: sessionToken,
        authenticated: false,
        provisioning: true,
        message: 'User profile updated',
        isNewUser: false,
        user: this.sanitizeUser(updatedUser),
      };
    } else {
      const primaryEmail = this.findPrimaryContact(normalizedContacts, 'email');
      const primaryPhone = this.findPrimaryContact(normalizedContacts, 'phone');

      const newUser = await this.usersService.create({
        email: primaryEmail?.value || null,
        phone: primaryPhone?.value || null,
        name: contactRegisterDto.name,
        contactInfo: normalizedContacts,
        password: null, // No password for contact-based provisioning.
        isActive: true,
        isVerified: false,
        lastActivity: new Date(),
        source: contactRegisterDto.source,
        perApplicationPreferences: this.mergeProvisioningSource(null, contactRegisterDto.source, contactRegisterDto.sessionId),
        sessionId: contactRegisterDto.sessionId,
      });

      const sessionToken = crypto.randomBytes(32).toString('hex');

      this.logger.log(`Contact-based user provisioned: ${newUser.id}`, 'AuthService');

      return {
        success: true,
        userId: newUser.id,
        sessionId: sessionToken,
        authenticated: false,
        provisioning: true,
        message: 'User registered successfully',
        isNewUser: true,
        user: this.sanitizeUser(newUser),
      };
    }
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const startedAt = Date.now();
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const nextFirstName = this.cleanOptionalString(dto.firstName);
    const nextLastName = this.cleanOptionalString(dto.lastName);
    const nextPhone = this.normalizePhone(dto.phone);
    const nextPreferences = this.mergeCanonicalProfile(user.perApplicationPreferences, this.cleanCanonicalProfilePatch(dto), dto.address);
    const nextContacts = nextPhone
      ? this.upsertPrimaryContact(user.contactInfo || [], {
          type: 'phone',
          value: nextPhone,
          isPrimary: true,
        })
      : user.contactInfo;

    await this.usersService.update(userId, {
      ...user,
      firstName: nextFirstName ?? user.firstName,
      lastName: nextLastName ?? user.lastName,
      phone: nextPhone || user.phone,
      contactInfo: nextContacts,
      perApplicationPreferences: nextPreferences,
      lastActivity: new Date(),
    } as User);

    const updatedUser = await this.usersService.findById(userId);
    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    this.logger.log(`Authenticated profile updated user=${userId} timestamp=${new Date().toISOString()} duration_ms=${Date.now() - startedAt}`, 'AuthService');
    return this.sanitizeUser(updatedUser);
  }

  async getProfileCheckoutData(userId: string) {
    const [user, deliveryAddresses, invoiceProfiles] = await Promise.all([this.usersService.findById(userId), this.usersService.listDeliveryAddresses(userId), this.usersService.listInvoiceProfiles(userId)]);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      schemaVersion: AUTH_CHECKOUT_DATA_SCHEMA_VERSION,
      user: this.sanitizeUser(user),
      deliveryAddresses: deliveryAddresses.map((address) => this.sanitizeDeliveryAddress(address)),
      invoiceProfiles: invoiceProfiles.map((profile) => this.sanitizeInvoiceProfile(profile)),
      defaults: {
        deliveryAddressId: deliveryAddresses.find((address) => address.isDefault)?.id || null,
        invoiceProfileId: invoiceProfiles.find((profile) => profile.isDefault)?.id || null,
      },
    };
  }

  async listDeliveryAddresses(userId: string) {
    const addresses = await this.usersService.listDeliveryAddresses(userId);
    return addresses.map((address) => this.sanitizeDeliveryAddress(address));
  }

  async getDeliveryAddress(userId: string, addressId: string) {
    return this.sanitizeDeliveryAddress(await this.usersService.getDeliveryAddress(userId, addressId));
  }

  async createDeliveryAddress(userId: string, dto: CreateDeliveryAddressDto) {
    return this.sanitizeDeliveryAddress(await this.usersService.createDeliveryAddress(userId, dto));
  }

  async updateDeliveryAddress(userId: string, addressId: string, dto: UpdateDeliveryAddressDto) {
    return this.sanitizeDeliveryAddress(await this.usersService.updateDeliveryAddress(userId, addressId, dto));
  }

  async deleteDeliveryAddress(userId: string, addressId: string) {
    await this.usersService.deleteDeliveryAddress(userId, addressId);
    return { success: true };
  }

  async setDefaultDeliveryAddress(userId: string, addressId: string) {
    return this.sanitizeDeliveryAddress(await this.usersService.setDefaultDeliveryAddress(userId, addressId));
  }

  async listInvoiceProfiles(userId: string) {
    const profiles = await this.usersService.listInvoiceProfiles(userId);
    return profiles.map((profile) => this.sanitizeInvoiceProfile(profile));
  }

  async getInvoiceProfile(userId: string, profileId: string) {
    return this.sanitizeInvoiceProfile(await this.usersService.getInvoiceProfile(userId, profileId));
  }

  async createInvoiceProfile(userId: string, dto: CreateInvoiceProfileDto) {
    return this.sanitizeInvoiceProfile(await this.usersService.createInvoiceProfile(userId, dto));
  }

  async updateInvoiceProfile(userId: string, profileId: string, dto: UpdateInvoiceProfileDto) {
    return this.sanitizeInvoiceProfile(await this.usersService.updateInvoiceProfile(userId, profileId, dto));
  }

  async deleteInvoiceProfile(userId: string, profileId: string) {
    await this.usersService.deleteInvoiceProfile(userId, profileId);
    return { success: true };
  }

  async setDefaultInvoiceProfile(userId: string, profileId: string) {
    return this.sanitizeInvoiceProfile(await this.usersService.setDefaultInvoiceProfile(userId, profileId));
  }

  private cleanCanonicalProfilePatch(dto: UpdateProfileDto): Record<string, unknown> {
    const patch: Record<string, unknown> = dto.profile && typeof dto.profile === 'object' && !Array.isArray(dto.profile) ? { ...dto.profile } : {};
    const avatarUrl = this.cleanOptionalString(dto.avatarUrl);
    if (avatarUrl !== undefined) {
      patch.avatarUrl = avatarUrl;
    }
    if (dto.settings && typeof dto.settings === 'object' && !Array.isArray(dto.settings)) {
      patch.settings = dto.settings;
    }
    return patch;
  }

  private mergeCanonicalProfile(existing: Record<string, unknown> | null | undefined, profilePatch?: Record<string, unknown>, addressPatch?: UpdateProfileDto['address']): Record<string, unknown> {
    const base = existing && typeof existing === 'object' && !Array.isArray(existing) ? existing : {};
    const existingCanonical = base.canonicalProfile && typeof base.canonicalProfile === 'object' && !Array.isArray(base.canonicalProfile) ? (base.canonicalProfile as Record<string, unknown>) : {};
    const existingAddress = existingCanonical.address && typeof existingCanonical.address === 'object' && !Array.isArray(existingCanonical.address) ? (existingCanonical.address as Record<string, unknown>) : {};
    const cleanedAddress = this.cleanAddress(addressPatch);
    const nextCanonical: Record<string, unknown> = {
      ...existingCanonical,
      ...(profilePatch || {}),
      updatedAt: new Date().toISOString(),
    };

    if (cleanedAddress) {
      nextCanonical.address = {
        ...existingAddress,
        ...cleanedAddress,
      };
    }

    return {
      ...base,
      canonicalProfile: nextCanonical,
    };
  }

  private cleanAddress(address?: UpdateProfileDto['address']): Record<string, string> | null {
    if (!address) {
      return null;
    }

    const cleaned: Record<string, string> = {};
    for (const key of ['firstName', 'lastName', 'street', 'city', 'postalCode', 'country', 'phone'] as const) {
      const value = this.cleanOptionalString(address[key]);
      if (value !== undefined) {
        cleaned[key] = key === 'phone' ? this.normalizePhone(value) || value : value;
      }
    }

    return Object.keys(cleaned).length ? cleaned : null;
  }

  private cleanOptionalString(value?: string | null): string | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    return String(value).trim();
  }

  private upsertPrimaryContact(contacts: Array<{ type: string; value: string; isPrimary?: boolean }>, nextContact: { type: string; value: string; isPrimary?: boolean }) {
    const normalized = this.normalizeContactInfo(contacts || []);
    const withoutSameType = normalized.map((contact) => (contact.type === nextContact.type ? { ...contact, isPrimary: false } : contact));
    const existingIndex = withoutSameType.findIndex((contact) => this.contactsMatch(contact.type, contact.value, nextContact.type, nextContact.value));

    if (existingIndex >= 0) {
      withoutSameType[existingIndex] = nextContact;
      return withoutSameType;
    }

    return [...withoutSameType, nextContact];
  }

  async loginContact(type: string, value: string) {
    const normalizedType = (type || '').trim().toLowerCase();
    const normalizedValue = this.normalizeContactValue(normalizedType, value);
    let user: User | null = null;

    if (normalizedType === 'email') {
      user = await this.usersService.findByEmail(normalizedValue);
    } else if (normalizedType === 'phone') {
      user = await this.usersService.findByPhone(normalizedValue);
    } else {
      user = await this.usersService.findByContact(normalizedType, normalizedValue);
    }

    if (!user) {
      throw new UnauthorizedException('Invalid contact information');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is inactive');
    }

    this.audit('warn', 'login_contact', 'verification_required', {
      identifier: normalizedValue,
      user_id: user.id,
      contact_type: normalizedType,
    });

    throw new UnauthorizedException('Contact login requires verified authentication. Use /auth/login with a password or the verified magic-link flow.');
  }

  async getUserMarketingPreferences(userId: string) {
    const startedAt = Date.now();
    const prefs = await this.usersService.getMarketingPreferences(userId);
    if (!prefs) {
      throw new NotFoundException('User not found');
    }
    this.logger.log(`Internal preferences read for user=${userId} timestamp=${new Date().toISOString()} duration_ms=${Date.now() - startedAt}`, 'AuthService');
    return prefs;
  }

  async updateUserMarketingPreferences(userId: string, dto: UpdateUserMarketingPreferencesDto) {
    const startedAt = Date.now();
    const user = await this.usersService.updateMarketingPreferences(userId, dto);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    this.logger.log(`Internal preferences updated for user=${userId} timestamp=${new Date().toISOString()} duration_ms=${Date.now() - startedAt}`, 'AuthService');
    return this.sanitizeUser(user);
  }

  async unsubscribeUser(userId: string) {
    const startedAt = Date.now();
    const user = await this.usersService.updateMarketingPreferences(userId, {
      unsubscribedAt: new Date().toISOString(),
      transactionalOnly: true,
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    this.logger.log(`User unsubscribed via internal API user=${userId} timestamp=${new Date().toISOString()} duration_ms=${Date.now() - startedAt}`, 'AuthService');
    return { userId, unsubscribedAt: user.unsubscribedAt };
  }

  async createMagicLinkToken(email: string, returnUrl: string): Promise<{ verifyUrl: string; userId: string }> {
    const validReturnUrl = this.validateReturnUrl(returnUrl);

    let user = await this.usersService.findByEmail(email);
    if (!user) {
      user = await this.usersService.create({
        email,
        isActive: true,
        isVerified: false,
      });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + this.magicLinkTtlMinutes * 60 * 1000);

    const magicToken = this.magicLinkTokenRepository.create({
      userId: user.id,
      email,
      token,
      returnUrl: validReturnUrl,
      clientId: null,
      state: null,
      expiresAt,
      used: false,
    });
    await this.magicLinkTokenRepository.save(magicToken);

    const domain = process.env.DOMAIN;
    const baseUrl = domain ? `https://${domain}` : process.env.FRONTEND_URL;
    if (!baseUrl) {
      this.audit('error', 'internal_magic_link_token', 'failure', {
        identifier: email,
        user_id: user.id,
        reason: 'base_url_not_configured',
      });
      throw new BadRequestException('Magic link base URL is not configured');
    }

    return {
      verifyUrl: `${baseUrl}/auth/magic-link/verify?token=${encodeURIComponent(token)}&return_url=${encodeURIComponent(validReturnUrl)}`,
      userId: user.id,
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
      this.audit('error', 'magic_link_request', 'failure', {
        identifier: dto.email,
        user_id: user.id,
        client_id: dto.client_id,
        reason: 'base_url_not_configured',
        duration_ms: Date.now() - startedAt,
      });
      throw new BadRequestException('Magic link base URL is not configured');
    }

    const verifyUrl = `${baseUrl}/auth/magic-link/verify?token=${encodeURIComponent(token)}&return_url=${encodeURIComponent(validReturnUrl)}`;

    const durationMs = Date.now() - startedAt;
    if (this.notificationsServiceUrl) {
      try {
        const rawFromDomain =
          this.getEmailDisplayDomainFromReturnUrl(validReturnUrl) || dto.app_domain || process.env.DOMAIN || '';
        if (!rawFromDomain) {
          this.audit('warn', 'magic_link_request', 'missing_display_domain', {
            identifier: dto.email,
            user_id: user.id,
            client_id: dto.client_id,
            duration_ms: Date.now() - startedAt,
          });
        }
        const fromDomain = this.normalizeEmailDisplayDomain(rawFromDomain);
        await firstValueFrom(
          this.httpService.post(
            `${this.notificationsServiceUrl}/notifications/send`,
            {
              channel: 'email',
              type: 'custom',
              recipient: dto.email,
              subject: this.getAuthEmailCopy('magic_link', this.normalizeAuthLang(dto.lang), this.magicLinkTtlMinutes).subject,
              message: this.buildAuthEmailHtml(
                verifyUrl,
                fromDomain,
                this.getAuthEmailCopy('magic_link', this.normalizeAuthLang(dto.lang), this.magicLinkTtlMinutes),
                this.normalizeAuthLang(dto.lang),
              ),
              contentType: 'text/html',
              fromName: fromDomain,
            },
            {
              headers: {
                Authorization: `Bearer ${this.notificationServiceToken}`,
              },
            },
          ),
        );
        this.audit('info', 'magic_link_request', 'email_sent', {
          identifier: dto.email,
          user_id: user.id,
          client_id: dto.client_id,
          duration_ms: durationMs,
        });
      } catch (error) {
        this.audit(
          'error',
          'magic_link_request',
          'email_send_failed',
          {
            identifier: dto.email,
            user_id: user.id,
            client_id: dto.client_id,
            reason: (error as Error).message,
            duration_ms: durationMs,
          },
          (error as Error).stack,
        );
      }
    } else {
      this.audit('warn', 'magic_link_request', 'created_email_not_sent', {
        identifier: dto.email,
        user_id: user.id,
        client_id: dto.client_id,
        reason: 'notification_service_url_not_configured',
        duration_ms: durationMs,
      });
    }

    return { success: true };
  }

  private contactCodeHash(identifier: string, code: string, purpose: 'login' | 'recovery' = 'login'): string {
    // 'login' must keep producing the pre-recovery string so codes issued by the previous
    // build still verify after deploy. Only 'recovery' adds a segment.
    const scope = purpose === 'recovery' ? 'recovery:' : '';
    return crypto
      .createHash('sha256')
      .update(`${identifier}:${code}:${scope}${requireJwtSecret()}`)
      .digest('hex');
  }

  private generateContactCode(): string {
    return String(crypto.randomInt(100000, 1000000));
  }

  private resolveContactCodePhoneChannel(value?: string): 'whatsapp' | 'telegram' | 'sms' {
    const normalized = (value || 'whatsapp').trim().toLowerCase();
    if (normalized === 'whatsapp' || normalized === 'telegram' || normalized === 'sms') {
      return normalized;
    }
    this.audit('warn', 'contact_code_config', 'invalid_phone_channel_defaulted', {
      reason: normalized,
    });
    return 'whatsapp';
  }

  private async sendContactCode(
    contactType: 'email' | 'phone',
    identifier: string,
    code: string,
    appDomain?: string,
    langRaw?: string,
    purpose: 'login' | 'recovery' = 'login',
    ttlMinutes: number = this.magicLinkTtlMinutes,
  ): Promise<boolean> {
    if (!this.notificationsServiceUrl) {
      return false;
    }

    const lang = this.normalizeAuthLang(langRaw);
    const fromDomain = this.normalizeEmailDisplayDomain(appDomain || process.env.DOMAIN || '');
    const channel = contactType === 'phone' ? this.contactCodePhoneChannel : 'email';
    const channelKey = contactType === 'phone' ? this.contactCodePhoneChannelKey : this.contactCodeEmailChannelKey;
    const contactCopy = this.getPlainEmailCopy(
      purpose === 'recovery' ? 'password_recovery' : 'contact_code',
      lang,
      ttlMinutes,
      undefined,
      code,
    );
    const isEmail = contactType === 'email';
    const codeEmailHtml = isEmail
      ? this.buildContactCodeEmailHtml(
          code,
          fromDomain,
          this.getContactCodeEmailCopy(purpose === 'recovery' ? 'password_recovery' : 'contact_code', lang, ttlMinutes),
          lang,
        )
      : undefined;
    const payload: Record<string, string | undefined> = {
      channel: channelKey ? undefined : channel,
      channelKey: channelKey || undefined,
      type: 'custom',
      recipient: identifier,
      subject: isEmail ? contactCopy.subject : undefined,
      message: codeEmailHtml || contactCopy.message,
      contentType: isEmail ? 'text/html' : undefined,
      fromName: fromDomain,
      service: 'auth-microservice',
      purpose: 'transactional',
    };

    await firstValueFrom(
      this.httpService.post(`${this.notificationsServiceUrl}/notifications/send`, payload, {
        headers: { Authorization: `Bearer ${this.notificationServiceToken}` },
      }),
    );
    return true;
  }

  async requestContactCode(dto: ContactCodeRequestDto, ip: string) {
    const startedAt = Date.now();
    const rawIdentifier = this.normalizeIdentifier(dto.identifier);
    const contactType: 'email' | 'phone' = this.isEmailIdentifier(rawIdentifier) ? 'email' : 'phone';
    const identifier = contactType === 'email' ? this.normalizeEmail(rawIdentifier) : this.normalizePhone(rawIdentifier);

    if (!identifier) {
      throw new BadRequestException('Identifier is required');
    }

    const purpose: 'login' | 'recovery' = dto.purpose === 'recovery' ? 'recovery' : 'login';
    const ttlMinutes = purpose === 'recovery' ? this.passwordRecoveryTtlMinutes : this.magicLinkTtlMinutes;

    // Purpose is part of the key so recovery attempts cannot drain the login budget.
    this.checkRateLimit(`contact_code:${purpose}:ip:${ip}`, this.magicLinkRateLimitPerIp);
    this.checkRateLimit(`contact_code:${purpose}:${contactType}:${identifier}`, this.magicLinkRateLimitPerEmail);

    const validReturnUrl = this.validateReturnUrl(dto.return_url);
    const user = contactType === 'email' ? await this.usersService.findByEmail(identifier) : await this.usersService.findByPhone(identifier);

    if (!user || !user.isActive) {
      this.audit('warn', 'contact_code_request', 'accepted_unknown_or_inactive_user', {
        identifier,
        contact_type: contactType,
        client_id: dto.client_id,
        duration_ms: Date.now() - startedAt,
      });
      // ttlMinutes is a constant for all callers, so returning it here discloses nothing.
      return { success: true, delivery: 'accepted' as const, ttlMinutes };
    }

    const code = this.generateContactCode();
    const token = this.contactCodeHash(identifier, code, purpose);
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
    const magicToken = this.magicLinkTokenRepository.create({
      userId: user.id,
      email: identifier,
      token,
      returnUrl: validReturnUrl,
      clientId: dto.client_id || null,
      state: dto.state || null,
      expiresAt,
      used: false,
      purpose,
    });
    await this.magicLinkTokenRepository.save(magicToken);

    let delivered = false;
    try {
      delivered = await this.sendContactCode(
        contactType,
        identifier,
        code,
        this.getEmailDisplayDomainFromReturnUrl(validReturnUrl) || dto.app_domain,
        dto.lang,
        purpose,
        ttlMinutes,
      );
    } catch (error) {
      this.audit(
        'error',
        'contact_code_request',
        'delivery_failed',
        {
          identifier,
          contact_type: contactType,
          user_id: user.id,
          client_id: dto.client_id,
          reason: (error as Error).message,
          duration_ms: Date.now() - startedAt,
        },
        (error as Error).stack,
      );
    }

    this.audit(delivered ? 'info' : 'warn', 'contact_code_request', delivered ? 'sent' : 'created_not_sent', {
      identifier,
      contact_type: contactType,
      user_id: user.id,
      client_id: dto.client_id,
      reason: delivered ? undefined : 'notification_provider_not_configured_or_failed',
      duration_ms: Date.now() - startedAt,
    });

    return { success: true, delivery: delivered ? ('sent' as const) : ('accepted' as const), ttlMinutes };
  }

  private async mintPasswordRecoveryGrant(
    userId: string,
    target: { returnUrl: string | null; clientId: string | null; state: string | null },
  ): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + this.passwordRecoveryTtlMinutes * 60 * 1000);
    const grant = this.passwordResetTokenRepository.create({
      userId,
      token,
      expiresAt,
      used: false,
      returnUrl: target.returnUrl || null,
      clientId: target.clientId,
      state: target.state,
    });
    await this.passwordResetTokenRepository.save(grant);
    return token;
  }

  private buildSetPasswordUrl(token: string, lang: 'en' | 'cs' | 'ru'): string {
    const frontendUrl = process.env.FRONTEND_URL;
    if (!frontendUrl) {
      throw new BadRequestException('Frontend URL is not configured');
    }
    // return_url, client_id and state are deliberately absent: they live on the grant row so
    // the completion target cannot be rewritten by editing this URL. `ttl` is display only.
    const params = new URLSearchParams({
      token,
      lang,
      ttl: String(this.passwordRecoveryTtlMinutes),
    });
    return `${frontendUrl}/set-password?${params.toString()}`;
  }

  async verifyContactCode(dto: ContactCodeVerifyDto) {
    const startedAt = Date.now();
    const rawIdentifier = this.normalizeIdentifier(dto.identifier);
    const contactType: 'email' | 'phone' = this.isEmailIdentifier(rawIdentifier) ? 'email' : 'phone';
    const identifier = contactType === 'email' ? this.normalizeEmail(rawIdentifier) : this.normalizePhone(rawIdentifier);
    const code = (dto.code || '').trim();
    const purpose: 'login' | 'recovery' = dto.purpose === 'recovery' ? 'recovery' : 'login';

    if (!identifier || !/^\d{6}$/.test(code)) {
      throw new UnauthorizedException('Invalid or expired sign-in code');
    }

    const tokenHash = this.contactCodeHash(identifier, code, purpose);
    const token = await this.magicLinkTokenRepository.findOne({
      where: { token: tokenHash, used: false },
      relations: ['user'],
    });

    // The purpose check is defence in depth: the hash already separates the two, and this
    // keeps them separated if the hash ever changes.
    if (!token || token.email !== identifier || (token.purpose || 'login') !== purpose || new Date() > token.expiresAt) {
      this.audit('warn', 'contact_code_verify', 'failure', {
        identifier,
        contact_type: contactType,
        reason: !token ? 'invalid_or_used_code' : 'expired_or_mismatched_code',
        duration_ms: Date.now() - startedAt,
      });
      throw new UnauthorizedException('Invalid or expired sign-in code');
    }

    token.used = true;
    await this.magicLinkTokenRepository.save(token);

    const user = await this.usersService.findById(token.userId);
    if (!user || !user.isActive) {
      this.audit('warn', 'contact_code_verify', 'failure', {
        identifier,
        contact_type: contactType,
        user_id: token.userId,
        reason: 'user_not_found_or_inactive',
        duration_ms: Date.now() - startedAt,
      });
      throw new UnauthorizedException('Invalid or expired sign-in code');
    }

    if (purpose === 'recovery') {
      const recoveryReturnUrl = this.validateReturnUrl(dto.return_url || token.returnUrl);
      const grantToken = await this.mintPasswordRecoveryGrant(user.id, {
        returnUrl: recoveryReturnUrl,
        clientId: token.clientId || dto.client_id || null,
        state: token.state || null,
      });

      this.audit('info', 'password_recovery_verify', 'success', {
        identifier,
        contact_type: contactType,
        user_id: user.id,
        client_id: token.clientId,
        duration_ms: Date.now() - startedAt,
      });

      return {
        recovery: true as const,
        ttlMinutes: this.passwordRecoveryTtlMinutes,
        redirectUrl: this.buildSetPasswordUrl(grantToken, this.normalizeAuthLang(dto.lang)),
      };
    }

    const finalReturnUrl = this.validateReturnUrl(dto.return_url || token.returnUrl);
    const tokens = await this.generateTokens(user.id, `${contactType}_code`, token.clientId || dto.client_id, finalReturnUrl);

    this.audit('info', 'contact_code_verify', 'success', {
      identifier,
      contact_type: contactType,
      user_id: user.id,
      client_id: token.clientId,
      duration_ms: Date.now() - startedAt,
    });

    return {
      user: this.sanitizeUser(user),
      ...tokens,
      redirectUrl: this.buildTokenHandoffUrl(finalReturnUrl, tokens, `${contactType}_code`, token.state || undefined),
    };
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
      this.audit(
        'error',
        'magic_link_verify',
        'failure',
        {
          reason: (err as Error).message,
          duration_ms: Date.now() - startedAt,
        },
        (err as Error).stack,
      );
      this.renderSafeError(res, 'Invalid or expired magic link.');
      return;
    }

    if (!token) {
      this.audit('warn', 'magic_link_verify', 'failure', {
        reason: 'invalid_or_used_token',
        duration_ms: Date.now() - startedAt,
      });
      this.renderSafeError(res, 'Invalid or expired magic link.');
      return;
    }

    if (new Date() > token.expiresAt) {
      this.audit('warn', 'magic_link_verify', 'failure', {
        identifier: token.email,
        user_id: token.userId,
        client_id: token.clientId,
        reason: 'expired_token',
        duration_ms: Date.now() - startedAt,
      });
      this.renderSafeError(res, 'Magic link has expired.');
      return;
    }

    const finalReturnUrl = this.validateReturnUrl(dto.return_url || token.returnUrl);

    token.used = true;
    await this.magicLinkTokenRepository.save(token);

    const user = await this.usersService.findById(token.userId);
    if (!user) {
      this.audit('warn', 'magic_link_verify', 'failure', {
        identifier: token.email,
        user_id: token.userId,
        client_id: token.clientId,
        reason: 'user_not_found',
        duration_ms: Date.now() - startedAt,
      });
      this.renderSafeError(res, 'User not found for magic link.');
      return;
    }

    const tokens = await this.generateTokens(user.id, 'magic_link', token.clientId, finalReturnUrl);
    const redirectUrl = this.buildTokenHandoffUrl(finalReturnUrl, tokens, 'magic_link', token.state || undefined);

    // Here, not in requestMagicLink. Requesting a link creates a user row for whatever address
    // was typed; only following the link proves the person can read that inbox. Emitting on
    // request would let a typo — or anyone entering a stranger's address — count as a conversion.
    //
    // This runs on every magic-link login, not only the first. The event id is derived from the
    // user id, so repeats collide with the consumer's primary key and are discarded as duplicates
    // rather than inflating registrations (C-005 §2.2b).
    await this.emitRegistration({
      userId: user.id,
      registrationMethod: 'magic_link',
      email: user.email,
      phone: user.phone,
      correlationId: token.state,
      applicationContext: token.clientId,
    });

    const durationMs = Date.now() - startedAt;
    this.audit('info', 'magic_link_verify', 'success', {
      identifier: token.email,
      user_id: token.userId,
      client_id: token.clientId,
      duration_ms: durationMs,
    });

    res.redirect(302, redirectUrl);
  }

  async oauthInit(provider: string, rawQuery: any, ip: string): Promise<string> {
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
    this.audit('info', 'oauth_init', 'success', {
      provider,
      client_id: clientId,
      duration_ms: durationMs,
    });

    return url.toString();
  }

  async oauthCallback(provider: string, rawQuery: any, res: Response): Promise<void> {
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
        this.audit('error', 'oauth_callback', 'failure', {
          provider,
          client_id: stateEntry.clientId,
          reason: 'provider_token_response_missing_access_token',
          duration_ms: Date.now() - startedAt,
        });
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
      this.audit(
        'error',
        'oauth_callback',
        'failure',
        {
          provider,
          client_id: stateEntry.clientId,
          reason: fbMessage,
          provider_error_code: fbCode,
          redirect_uri: redirectUri,
          duration_ms: Date.now() - startedAt,
        },
        error?.stack,
      );
      this.renderSafeError(res, 'OAuth authentication failed.');
      return;
    }

    if (!providerEmail) {
      this.audit('warn', 'oauth_callback', 'failure', {
        provider,
        client_id: stateEntry.clientId,
        reason: 'provider_email_missing',
        duration_ms: Date.now() - startedAt,
      });
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

      // Only inside this branch: an existing user signing in with the same provider again is a
      // login, not a registration. Proven identity — the provider vouched for the address.
      await this.emitRegistration({
        userId: user.id,
        registrationMethod: 'oauth',
        email: user.email,
        correlationId: stateEntry.appState,
        applicationContext: stateEntry.clientId,
      });
    }

    const tokens = await this.generateTokens(user.id, provider, stateEntry.clientId, stateEntry.returnUrl);
    const redirectUrl = this.buildTokenHandoffUrl(stateEntry.returnUrl, tokens, provider, stateEntry.appState);

    const durationMs = Date.now() - startedAt;
    this.audit('info', 'oauth_callback', 'success', {
      provider,
      identifier: providerEmail,
      user_id: user.id,
      client_id: stateEntry.clientId,
      duration_ms: durationMs,
    });

    res.redirect(302, redirectUrl);
  }

  private sanitizeUser(user: User) {
    const { password, ...sanitized } = user;
    const preferences = user.perApplicationPreferences as Record<string, unknown> | null | undefined;
    const canonicalProfile = preferences?.canonicalProfile && typeof preferences.canonicalProfile === 'object' && !Array.isArray(preferences.canonicalProfile) ? (preferences.canonicalProfile as Record<string, unknown>) : undefined;
    const profileAddress = canonicalProfile?.address && typeof canonicalProfile.address === 'object' && !Array.isArray(canonicalProfile.address) ? canonicalProfile.address : undefined;

    const profileSettings = canonicalProfile?.settings && typeof canonicalProfile.settings === 'object' && !Array.isArray(canonicalProfile.settings) ? canonicalProfile.settings : undefined;
    const avatarUrl = typeof canonicalProfile?.avatarUrl === 'string' ? canonicalProfile.avatarUrl : undefined;

    return {
      ...sanitized,
      ...(canonicalProfile ? { canonicalProfile } : {}),
      ...(profileAddress ? { profileAddress } : {}),
      ...(avatarUrl ? { avatarUrl, profileImageUrl: avatarUrl } : {}),
      ...(profileSettings ? { profileSettings } : {}),
    };
  }

  private sanitizeDeliveryAddress(address: UserDeliveryAddress) {
    const { user, userId, deletedAt, ...sanitized } = address as UserDeliveryAddress & {
      user?: User;
      deletedAt?: Date | null;
    };
    return sanitized;
  }

  private sanitizeInvoiceProfile(profile: UserInvoiceProfile) {
    const { user, userId, deletedAt, ...sanitized } = profile as UserInvoiceProfile & {
      user?: User;
      deletedAt?: Date | null;
    };
    return sanitized;
  }

  private resolveServiceIdentity(user: User) {
    if (user.userType !== 'service') {
      return {};
    }

    const preferences = user.perApplicationPreferences as
      | {
          serviceIdentity?: {
            serviceName?: unknown;
            clientId?: unknown;
            authMethod?: unknown;
          };
        }
      | null
      | undefined;
    const identity = preferences?.serviceIdentity;
    const serviceName = typeof identity?.serviceName === 'string' ? identity.serviceName.trim() : '';
    const clientId = typeof identity?.clientId === 'string' ? identity.clientId.trim() : serviceName;
    const authMethod = typeof identity?.authMethod === 'string' ? identity.authMethod.trim() : 'auth-service-jwt';

    if (!serviceName) {
      return {};
    }

    return {
      serviceName,
      service: serviceName,
      clientId,
      authMethod,
    };
  }

  private buildTokenHandoffUrl(returnUrl: string, tokens: { accessToken: string; refreshToken?: string }, authMethod: string, state?: string): string {
    const redirectUrl = new URL(returnUrl);
    const decoded = this.jwtService.decode(tokens.accessToken) as {
      exp?: number;
    } | null;
    const expiresAtIso = decoded && decoded.exp ? new Date(decoded.exp * 1000).toISOString() : new Date().toISOString();
    const fragment = new URLSearchParams();

    fragment.set('access_token', tokens.accessToken);
    if (tokens.refreshToken) {
      fragment.set('refresh_token', tokens.refreshToken);
    }
    fragment.set('expires_at', expiresAtIso);
    if (state) {
      fragment.set('state', state);
    }
    fragment.set('auth_method', authMethod);

    redirectUrl.hash = fragment.toString();
    return redirectUrl.toString();
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
    res.status(400).send(`<html><body><h1>Authentication error</h1><p>${message}</p></body></html>`);
  }

  private normalizeAuthLang(raw?: string): 'en' | 'cs' | 'ru' {
    if (!raw) return 'en';
    const primary = String(raw).trim().toLowerCase().split(/[-_]/)[0];
    if (primary === 'cs' || primary === 'ru' || primary === 'en') {
      return primary;
    }
    return 'en';
  }

  private getAuthEmailCopy(
    kind: 'password_reset' | 'magic_link',
    lang: 'en' | 'cs' | 'ru',
    ttlMinutes: number,
  ): { subject: string; title: string; body: string; cta: string; fallback: string; ignore: string } {
    const copies = {
      password_reset: {
        en: {
          subject: 'Password Reset Request',
          title: 'Reset your password',
          body: `Click the button below to set a new password. This link will expire in <strong>${ttlMinutes} minutes</strong>.`,
          cta: 'Reset password',
          fallback: 'If the button does not work, copy this link into your browser:',
          ignore: 'If you did not request this email, you can safely ignore it.',
        },
        cs: {
          subject: 'Obnovení hesla',
          title: 'Obnovte si heslo',
          body: `Kliknutím na tlačítko níže si nastavíte nové heslo. Odkaz je platný <strong>${ttlMinutes} minut</strong>.`,
          cta: 'Obnovit heslo',
          fallback: 'Pokud tlačítko nefunguje, zkopírujte tento odkaz do prohlížeče:',
          ignore: 'Pokud jste tento e-mail neočekávali, můžete ho ignorovat.',
        },
        ru: {
          subject: 'Сброс пароля',
          title: 'Сбросьте пароль',
          body: `Нажмите кнопку ниже, чтобы задать новый пароль. Ссылка действует <strong>${ttlMinutes} мин.</strong>.`,
          cta: 'Сбросить пароль',
          fallback: 'Если кнопка не работает, скопируйте эту ссылку в браузер:',
          ignore: 'Если вы не запрашивали это письмо, просто проигнорируйте его.',
        },
      },
      magic_link: {
        en: {
          subject: 'Sign-in link',
          title: 'Sign in with one click',
          body: `Click the button below to sign in to your account. This link will expire in <strong>${ttlMinutes} minutes</strong>.`,
          cta: 'Sign in',
          fallback: 'If the button does not work, copy this link into your browser:',
          ignore: 'If you did not request this email, you can safely ignore it.',
        },
        cs: {
          subject: 'Přihlašovací odkaz',
          title: 'Přihlaste se jedním kliknutím',
          body: `Kliknutím na tlačítko níže se přihlásíte do svého účtu. Odkaz je platný <strong>${ttlMinutes} minut</strong>.`,
          cta: 'Přihlásit se',
          fallback: 'Pokud tlačítko nefunguje, zkopírujte tento odkaz do prohlížeče:',
          ignore: 'Pokud jste tento e-mail neočekávali, můžete ho ignorovat.',
        },
        ru: {
          subject: 'Ссылка для входа',
          title: 'Войдите одним нажатием',
          body: `Нажмите кнопку ниже, чтобы войти в аккаунт. Ссылка действует <strong>${ttlMinutes} мин.</strong>.`,
          cta: 'Войти',
          fallback: 'Если кнопка не работает, скопируйте эту ссылку в браузер:',
          ignore: 'Если вы не запрашивали это письмо, просто проигнорируйте его.',
        },
      },
    } as const;
    return copies[kind][lang];
  }

  private getPlainEmailCopy(
    kind: 'contact_code' | 'email_change' | 'password_recovery',
    lang: 'en' | 'cs' | 'ru',
    ttlMinutes: number,
    verifyUrl?: string,
    code?: string,
  ): { subject: string; message: string } {
    if (kind === 'password_recovery') {
      const messages = {
        en: {
          subject: 'Alfares password recovery code',
          message: `Your Alfares password recovery code is ${code}. It expires in ${ttlMinutes} minutes. Enter it to choose a new password. If you did not ask to reset your password, ignore this message — your password has not changed.`,
        },
        cs: {
          subject: 'Kód pro obnovení hesla Alfares',
          message: `Váš kód pro obnovení hesla Alfares je ${code}. Platí ${ttlMinutes} minut. Zadejte ho a zvolte si nové heslo. Pokud jste o obnovení hesla nežádali, zprávu ignorujte — vaše heslo se nezměnilo.`,
        },
        ru: {
          subject: 'Код восстановления пароля Alfares',
          message: `Ваш код восстановления пароля Alfares: ${code}. Он действует ${ttlMinutes} мин. Введите его, чтобы задать новый пароль. Если вы не запрашивали восстановление пароля, проигнорируйте это сообщение — ваш пароль не изменился.`,
        },
      } as const;
      return messages[lang];
    }

    if (kind === 'contact_code') {
      const messages = {
        en: {
          subject: 'Alfares sign-in code',
          message: `Your Alfares sign-in code is ${code}. It expires in ${ttlMinutes} minutes.`,
        },
        cs: {
          subject: 'Přihlašovací kód Alfares',
          message: `Váš přihlašovací kód Alfares je ${code}. Platí ${ttlMinutes} minut.`,
        },
        ru: {
          subject: 'Код входа Alfares',
          message: `Ваш код входа Alfares: ${code}. Он действует ${ttlMinutes} мин.`,
        },
      } as const;
      return messages[lang];
    }

    const messages = {
      en: {
        subject: 'Confirm your email change',
        message: `Confirm your Auth account email change: ${verifyUrl}\n\nThis link expires in ${ttlMinutes} minutes.`,
      },
      cs: {
        subject: 'Potvrďte změnu e-mailu',
        message: `Potvrďte změnu e-mailu u účtu Auth: ${verifyUrl}\n\nTento odkaz vyprší za ${ttlMinutes} minut.`,
      },
      ru: {
        subject: 'Подтвердите смену email',
        message: `Подтвердите смену email аккаунта Auth: ${verifyUrl}\n\nСсылка действует ${ttlMinutes} мин.`,
      },
    } as const;
    return messages[lang];
  }

  private getContactCodeEmailCopy(
    kind: 'contact_code' | 'password_recovery',
    lang: 'en' | 'cs' | 'ru',
    ttlMinutes: number,
  ): { subject: string; title: string; intro: string; label: string; expiry: string; ignore: string } {
    const copies = {
      contact_code: {
        en: {
          subject: 'Alfares sign-in code',
          title: 'Your sign-in code',
          intro: 'Enter this code to sign in to your account.',
          label: 'Sign-in code',
          expiry: `This code expires in <strong>${ttlMinutes} minutes</strong>.`,
          ignore: 'If you did not request this code, you can safely ignore this email.',
        },
        cs: {
          subject: 'Přihlašovací kód Alfares',
          title: 'Váš přihlašovací kód',
          intro: 'Zadejte tento kód pro přihlášení k účtu.',
          label: 'Přihlašovací kód',
          expiry: `Kód je platný <strong>${ttlMinutes} minut</strong>.`,
          ignore: 'Pokud jste o kód nežádali, můžete tento e-mail ignorovat.',
        },
        ru: {
          subject: 'Код входа Alfares',
          title: 'Ваш код входа',
          intro: 'Введите этот код, чтобы войти в аккаунт.',
          label: 'Код входа',
          expiry: `Код действует <strong>${ttlMinutes} мин.</strong>`,
          ignore: 'Если вы не запрашивали код, просто проигнорируйте это письмо.',
        },
      },
      password_recovery: {
        en: {
          subject: 'Alfares password recovery code',
          title: 'Your password recovery code',
          intro: 'Enter this code to choose a new password.',
          label: 'Recovery code',
          expiry: `This code expires in <strong>${ttlMinutes} minutes</strong>.`,
          ignore: 'If you did not ask to reset your password, ignore this message — your password has not changed.',
        },
        cs: {
          subject: 'Kód pro obnovení hesla Alfares',
          title: 'Váš kód pro obnovení hesla',
          intro: 'Zadejte tento kód a zvolte si nové heslo.',
          label: 'Kód pro obnovení',
          expiry: `Kód je platný <strong>${ttlMinutes} minut</strong>.`,
          ignore: 'Pokud jste o obnovení hesla nežádali, zprávu ignorujte — vaše heslo se nezměnilo.',
        },
        ru: {
          subject: 'Код восстановления пароля Alfares',
          title: 'Ваш код восстановления пароля',
          intro: 'Введите этот код, чтобы задать новый пароль.',
          label: 'Код восстановления',
          expiry: `Код действует <strong>${ttlMinutes} мин.</strong>`,
          ignore: 'Если вы не запрашивали восстановление пароля, проигнорируйте это письмо — ваш пароль не изменился.',
        },
      },
    } as const;
    return copies[kind][lang];
  }

  private normalizeEmailDisplayDomain(domainRaw?: string): string {
    const candidate = String(domainRaw || '').trim();
    if (!candidate) {
      return 'alfares.cz';
    }

    const host = candidate.replace(/^https?:\/\//i, '').split('/')[0].trim();
    const hostnamePattern =
      /^(?:localhost|[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*)(?::\d{1,5})?$/i;
    if (!hostnamePattern.test(host)) {
      return 'alfares.cz';
    }

    const port = host.match(/:(\d{1,5})$/)?.[1];
    if (port && Number(port) > 65535) {
      return 'alfares.cz';
    }

    return host.toLowerCase();
  }

  private getEmailDisplayDomainFromReturnUrl(returnUrl?: string | null): string | undefined {
    if (!returnUrl) {
      return undefined;
    }

    try {
      return new URL(returnUrl).host;
    } catch {
      return undefined;
    }
  }

  private buildContactCodeEmailHtml(
    code: string,
    domainRaw: string,
    copy: { subject: string; title: string; intro: string; label: string; expiry: string; ignore: string },
    lang: 'en' | 'cs' | 'ru',
  ): string {
    const BG_URL = 'https://speakasap.com/static/big_brother/assets/bg.png';
    const BLUE = '#1E88E5';
    const LIGHT_BLUE = '#BBDEFB';
    const CARD_BG = '#F5F5F5';
    const domain = this.normalizeEmailDisplayDomain(domainRaw);
    const safeCode = String(code).replace(/[^0-9A-Za-z-]/g, '');

    return `<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${copy.subject}</title></head>
<body style="margin:0;padding:0;background-color:${LIGHT_BLUE};background-image:url('${BG_URL}');background-size:cover;background-position:center;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td align="center" style="padding:40px 16px;">
    <table width="100%" style="max-width:640px;border-radius:8px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.12);" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="background:${BLUE};padding:24px 32px;">
        <a href="https://${domain}" style="color:#fff;text-decoration:none;font-size:20px;font-weight:bold;">${domain}</a>
      </td></tr>
      <tr><td style="background:${CARD_BG};padding:32px;">
        <h2 style="margin:0 0 16px;color:#212121;font-size:22px;">${copy.title}</h2>
        <p style="margin:0 0 24px;color:#424242;font-size:15px;">${copy.intro}</p>
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
          <tr><td align="center" style="background:#FFFFFF;border:2px solid ${BLUE};border-radius:8px;padding:24px 16px;">
            <p style="margin:0 0 8px;color:#757575;font-size:12px;letter-spacing:2px;text-transform:uppercase;">${copy.label}</p>
            <p style="margin:0;color:#0D47A1;font-family:'Courier New',Courier,monospace;font-size:44px;line-height:1.2;font-weight:bold;letter-spacing:10px;white-space:nowrap;">${safeCode}</p>
          </td></tr>
        </table>
        <p style="margin:0 0 16px;color:#1565C0;font-size:14px;text-align:center;">${copy.expiry}</p>
        <p style="color:#9E9E9E;font-size:12px;margin:16px 0 0;">${copy.ignore}</p>
      </td></tr>
      <tr><td style="background:${BLUE};padding:16px 32px;text-align:center;">
        <a href="https://${domain}" style="color:#fff;text-decoration:none;font-size:13px;">${domain}</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
  }

  private buildAuthEmailHtml(
    actionUrl: string,
    domain: string,
    copy: { subject: string; title: string; body: string; cta: string; fallback: string; ignore: string },
    lang: 'en' | 'cs' | 'ru',
  ): string {
    const BG_URL = 'https://speakasap.com/static/big_brother/assets/bg.png';
    const BLUE = '#1E88E5';
    const LIGHT_BLUE = '#BBDEFB';
    const CARD_BG = '#F5F5F5';
    const displayDomain = this.normalizeEmailDisplayDomain(domain);

    return `<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${copy.subject}</title></head>
<body style="margin:0;padding:0;background-color:${LIGHT_BLUE};background-image:url('${BG_URL}');background-size:cover;background-position:center;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr><td align="center" style="padding:40px 16px;">
    <table width="100%" style="max-width:640px;border-radius:8px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.12);" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="background:${BLUE};padding:24px 32px;">
        <a href="https://${displayDomain}" style="color:#fff;text-decoration:none;font-size:20px;font-weight:bold;">${displayDomain}</a>
      </td></tr>
      <tr><td style="background:${CARD_BG};padding:32px;">
        <h2 style="margin:0 0 16px;color:#212121;font-size:22px;">${copy.title}</h2>
        <div style="border-left:4px solid ${BLUE};background:#E3F2FD;padding:16px 20px;border-radius:4px;margin-bottom:24px;">
          <p style="margin:0;color:#1565C0;font-size:15px;">${copy.body}</p>
        </div>
        <table cellpadding="0" cellspacing="0" border="0" style="margin:0 auto 24px;">
          <tr><td align="center" style="border-radius:6px;background:${BLUE};">
            <a href="${actionUrl}" style="display:inline-block;padding:14px 32px;color:#fff;font-size:16px;font-weight:bold;text-decoration:none;border-radius:6px;">${copy.cta}</a>
          </td></tr>
        </table>
        <p style="color:#757575;font-size:13px;margin:0;">${copy.fallback}<br><a href="${actionUrl}" style="color:${BLUE};word-break:break-all;">${actionUrl}</a></p>
        <p style="color:#9E9E9E;font-size:12px;margin:16px 0 0;">${copy.ignore}</p>
      </td></tr>
      <tr><td style="background:${BLUE};padding:16px 32px;text-align:center;">
        <a href="https://${displayDomain}" style="color:#fff;text-decoration:none;font-size:13px;">${displayDomain}</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
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
        profileUrl: process.env.GOOGLE_OAUTH_PROFILE_URL || 'https://openidconnect.googleapis.com/v1/userinfo',
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
        profileUrl: process.env.FACEBOOK_OAUTH_PROFILE_URL || 'https://graph.facebook.com/me?fields=id,name,email',
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

  async checkEmailExists(email: string): Promise<boolean> {
    const user = await this.usersService.findByEmail(email.toLowerCase().trim());
    return !!user;
  }
}
