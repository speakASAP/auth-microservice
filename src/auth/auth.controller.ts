/**
 * Auth Controller
 */

import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
  Query,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ValidateTokenDto } from './dto/validate-token.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { PasswordResetRequestDto } from './dto/password-reset-request.dto';
import { PasswordResetConfirmDto } from './dto/password-reset-confirm.dto';
import { PasswordChangeDto } from './dto/password-change.dto';
import { ContactRegisterDto } from './dto/contact-register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { MagicLinkRequestDto } from './dto/magic-link-request.dto';
import { MagicLinkVerifyDto } from './dto/magic-link-verify.dto';
import { InternalServiceGuard } from './guards/internal-service.guard';
import { UpdateUserMarketingPreferencesDto } from './dto/update-user-marketing-preferences.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
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
    return { user: req.user };
  }

  @Post('magic-link/request')
  async requestMagicLink(@Body() dto: MagicLinkRequestDto, @Request() req) {
    return this.authService.requestMagicLink(dto, req.ip);
  }

  @Get('magic-link/verify')
  async verifyMagicLink(@Query() query: MagicLinkVerifyDto, @Res() res: Response) {
    await this.authService.verifyMagicLink(query, res);
  }

  @Get('oauth/:provider')
  async oauthInit(
    @Request() req,
    @Res() res: Response,
  ) {
    const url = await this.authService.oauthInit(req.params.provider, req.query, req.ip);
    res.redirect(url);
  }

  @Get('oauth/callback/:provider')
  async oauthCallback(
    @Request() req,
    @Res() res: Response,
  ) {
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
  async updateUserPreferences(
    @Param('userId') userId: string,
    @Body() dto: UpdateUserMarketingPreferencesDto,
  ) {
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

