/**
 * Auth Controller
 */

import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
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

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
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
}

