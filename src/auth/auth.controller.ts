/**
 * Auth Controller
 */

import { Controller, Delete, Post, Get, Patch, Param, Body, UseGuards, Request, Query, Res, UnauthorizedException, ParseUUIDPipe } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ValidateTokenDto } from './dto/validate-token.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { PasswordResetRequestDto } from './dto/password-reset-request.dto';
import { PasswordResetConfirmDto } from './dto/password-reset-confirm.dto';
import { PasswordChangeDto } from './dto/password-change.dto';
import { EmailChangeRequestDto } from './dto/email-change-request.dto';
import { EmailChangeConfirmDto } from './dto/email-change-confirm.dto';
import { ContactRegisterDto } from './dto/contact-register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { MagicLinkRequestDto } from './dto/magic-link-request.dto';
import { MagicLinkVerifyDto } from './dto/magic-link-verify.dto';
import { ContactCodeRequestDto } from './dto/contact-code-request.dto';
import { ContactCodeVerifyDto } from './dto/contact-code-verify.dto';
import { InternalServiceGuard } from './guards/internal-service.guard';
import { UpdateUserMarketingPreferencesDto } from './dto/update-user-marketing-preferences.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CreateDeliveryAddressDto, UpdateDeliveryAddressDto } from './dto/delivery-address.dto';
import { CreateInvoiceProfileDto, UpdateInvoiceProfileDto } from './dto/invoice-profile.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto, @Request() req) {
    // ip and user-agent are consent evidence, not telemetry: the marketing consent record has to
    // show who agreed, to which text, from where and when.
    return this.authService.register(registerDto, {
      ip: req?.ip ?? req?.headers?.['x-forwarded-for'] ?? null,
      userAgent: req?.headers?.['user-agent'] ?? null,
    });
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    try {
      return await this.authService.login(loginDto);
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Invalid credentials');
    }
  }

  @Post('validate')
  async validateToken(@Body() validateTokenDto: ValidateTokenDto) {
    const user = await this.authService.validateToken(validateTokenDto.token);
    return { valid: true, user };
  }

  @Post('refresh')
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshToken(refreshTokenDto.refreshToken);
  }

  @Post('password-reset-request')
  async requestPasswordReset(@Body() passwordResetRequestDto: PasswordResetRequestDto) {
    return this.authService.requestPasswordReset(passwordResetRequestDto);
  }

  @Post('password-reset-confirm')
  async confirmPasswordReset(@Body() passwordResetConfirmDto: PasswordResetConfirmDto) {
    return this.authService.confirmPasswordReset(passwordResetConfirmDto);
  }

  @Post('password-change')
  @UseGuards(JwtAuthGuard)
  async changePassword(@Request() req, @Body() passwordChangeDto: PasswordChangeDto) {
    return this.authService.changePassword(req.user.id, passwordChangeDto);
  }

  @Post('password-set')
  @UseGuards(JwtAuthGuard)
  async setInitialPassword(@Request() req, @Body() body: { newPassword: string }) {
    return this.authService.setInitialPassword(req.user.id, body.newPassword);
  }

  @Post('email-change-request')
  @UseGuards(JwtAuthGuard)
  async requestEmailChange(@Request() req, @Body() dto: EmailChangeRequestDto) {
    return this.authService.requestEmailChange(req.user.id, dto);
  }

  @Post('email-change-confirm')
  async confirmEmailChange(@Body() dto: EmailChangeConfirmDto) {
    return this.authService.confirmEmailChange(dto.token);
  }

  @Get('email-change-confirm')
  async confirmEmailChangeLink(@Query('token') token: string) {
    return this.authService.confirmEmailChange(token);
  }

  @Post('register-contact')
  async registerContact(@Body() contactRegisterDto: ContactRegisterDto) {
    return this.authService.registerContact(contactRegisterDto);
  }

  @Post('login-contact')
  async loginContact(@Body() body: { type: string; value: string }) {
    return this.authService.loginContact(body.type, body.value);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req) {
    return { user: await this.authService.getProfile(req.user.id) };
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(@Request() req, @Body() dto: UpdateProfileDto) {
    return { user: await this.authService.updateProfile(req.user.id, dto) };
  }

  @Get('profile/checkout-data')
  @UseGuards(JwtAuthGuard)
  async getProfileCheckoutData(@Request() req) {
    return await this.authService.getProfileCheckoutData(req.user.id);
  }

  @Get('profile/delivery-addresses')
  @UseGuards(JwtAuthGuard)
  async listDeliveryAddresses(@Request() req) {
    return {
      deliveryAddresses: await this.authService.listDeliveryAddresses(req.user.id),
    };
  }

  @Post('profile/delivery-addresses')
  @UseGuards(JwtAuthGuard)
  async createDeliveryAddress(@Request() req, @Body() dto: CreateDeliveryAddressDto) {
    return {
      deliveryAddress: await this.authService.createDeliveryAddress(req.user.id, dto),
    };
  }

  @Get('profile/delivery-addresses/:addressId')
  @UseGuards(JwtAuthGuard)
  async getDeliveryAddress(@Request() req, @Param('addressId', new ParseUUIDPipe({ version: '4' })) addressId: string) {
    return {
      deliveryAddress: await this.authService.getDeliveryAddress(req.user.id, addressId),
    };
  }

  @Patch('profile/delivery-addresses/:addressId')
  @UseGuards(JwtAuthGuard)
  async updateDeliveryAddress(@Request() req, @Param('addressId', new ParseUUIDPipe({ version: '4' })) addressId: string, @Body() dto: UpdateDeliveryAddressDto) {
    return {
      deliveryAddress: await this.authService.updateDeliveryAddress(req.user.id, addressId, dto),
    };
  }

  @Delete('profile/delivery-addresses/:addressId')
  @UseGuards(JwtAuthGuard)
  async deleteDeliveryAddress(@Request() req, @Param('addressId', new ParseUUIDPipe({ version: '4' })) addressId: string) {
    return await this.authService.deleteDeliveryAddress(req.user.id, addressId);
  }

  @Post('profile/delivery-addresses/:addressId/default')
  @UseGuards(JwtAuthGuard)
  async setDefaultDeliveryAddress(@Request() req, @Param('addressId', new ParseUUIDPipe({ version: '4' })) addressId: string) {
    return {
      deliveryAddress: await this.authService.setDefaultDeliveryAddress(req.user.id, addressId),
    };
  }

  @Get('profile/invoice-profiles')
  @UseGuards(JwtAuthGuard)
  async listInvoiceProfiles(@Request() req) {
    return {
      invoiceProfiles: await this.authService.listInvoiceProfiles(req.user.id),
    };
  }

  @Post('profile/invoice-profiles')
  @UseGuards(JwtAuthGuard)
  async createInvoiceProfile(@Request() req, @Body() dto: CreateInvoiceProfileDto) {
    return {
      invoiceProfile: await this.authService.createInvoiceProfile(req.user.id, dto),
    };
  }

  @Get('profile/invoice-profiles/:profileId')
  @UseGuards(JwtAuthGuard)
  async getInvoiceProfile(@Request() req, @Param('profileId', new ParseUUIDPipe({ version: '4' })) profileId: string) {
    return {
      invoiceProfile: await this.authService.getInvoiceProfile(req.user.id, profileId),
    };
  }

  @Patch('profile/invoice-profiles/:profileId')
  @UseGuards(JwtAuthGuard)
  async updateInvoiceProfile(@Request() req, @Param('profileId', new ParseUUIDPipe({ version: '4' })) profileId: string, @Body() dto: UpdateInvoiceProfileDto) {
    return {
      invoiceProfile: await this.authService.updateInvoiceProfile(req.user.id, profileId, dto),
    };
  }

  @Delete('profile/invoice-profiles/:profileId')
  @UseGuards(JwtAuthGuard)
  async deleteInvoiceProfile(@Request() req, @Param('profileId', new ParseUUIDPipe({ version: '4' })) profileId: string) {
    return await this.authService.deleteInvoiceProfile(req.user.id, profileId);
  }

  @Post('profile/invoice-profiles/:profileId/default')
  @UseGuards(JwtAuthGuard)
  async setDefaultInvoiceProfile(@Request() req, @Param('profileId', new ParseUUIDPipe({ version: '4' })) profileId: string) {
    return {
      invoiceProfile: await this.authService.setDefaultInvoiceProfile(req.user.id, profileId),
    };
  }

  @Post('magic-link/request')
  async requestMagicLink(@Body() dto: MagicLinkRequestDto, @Request() req) {
    return this.authService.requestMagicLink(dto, req.ip);
  }

  @Get('magic-link/verify')
  async verifyMagicLink(@Query() query: MagicLinkVerifyDto, @Res() res: Response) {
    await this.authService.verifyMagicLink(query, res);
  }

  @Post('contact-code/request')
  async requestContactCode(@Body() dto: ContactCodeRequestDto, @Request() req) {
    return this.authService.requestContactCode(dto, req.ip);
  }

  @Post('contact-code/verify')
  async verifyContactCode(@Body() dto: ContactCodeVerifyDto) {
    return this.authService.verifyContactCode(dto);
  }

  @Get('oauth/:provider')
  async oauthInit(@Request() req, @Res() res: Response) {
    const url = await this.authService.oauthInit(req.params.provider, req.query, req.ip);
    res.redirect(url);
  }

  @Get('oauth/callback/:provider')
  async oauthCallback(@Request() req, @Res() res: Response) {
    await this.authService.oauthCallback(req.params.provider, req.query, res);
  }

  @Get('validate-return-url')
  validateReturnUrl(@Query('return_url') returnUrl: string) {
    const validReturnUrl = this.authService.validateReturnUrlForClient(returnUrl || '');
    return { valid: true, return_url: validReturnUrl };
  }

  @Get('internal/users/:userId/preferences')
  @UseGuards(InternalServiceGuard)
  async getUserPreferences(@Param('userId') userId: string) {
    return this.authService.getUserMarketingPreferences(userId);
  }

  @Patch('internal/users/:userId/preferences')
  @UseGuards(InternalServiceGuard)
  async updateUserPreferences(@Param('userId') userId: string, @Body() dto: UpdateUserMarketingPreferencesDto) {
    return this.authService.updateUserMarketingPreferences(userId, dto);
  }

  @Post('internal/users/:userId/unsubscribe')
  @UseGuards(InternalServiceGuard)
  async unsubscribeUser(@Param('userId') userId: string) {
    return this.authService.unsubscribeUser(userId);
  }

  @Post('internal/magic-link/token')
  @UseGuards(InternalServiceGuard)
  async createMagicLinkToken(@Body() body: { email: string; return_url: string }) {
    return this.authService.createMagicLinkToken(body.email, body.return_url);
  }

  @Get('internal/check-email')
  @UseGuards(InternalServiceGuard)
  async checkEmail(@Query('email') email: string) {
    if (!email) return { exists: false };
    const exists = await this.authService.checkEmailExists(email);
    return { exists };
  }
}
