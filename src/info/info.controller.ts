/**
 * Info Controller
 * Provides service information and API documentation endpoints
 */

import { Controller, Get } from '@nestjs/common';

@Controller()
export class InfoController {
  @Get()
  getServiceInfo() {
    return {
      service: 'auth-microservice',
      description: 'Centralized authentication and login service',
      version: '1.0.0',
      status: 'operational',
      endpoints: {
        health: '/health',
        api: '/api/',
        register: 'POST /auth/register',
        login: 'POST /auth/login',
        validate: 'POST /auth/validate',
        refresh: 'POST /auth/refresh',
        passwordReset: 'POST /auth/password-reset-request',
        passwordResetConfirm: 'POST /auth/password-reset-confirm',
        passwordChange: 'POST /auth/password-change',
        registerContact: 'POST /auth/register-contact',
        loginContact: 'POST /auth/login-contact',
        profile: 'GET /auth/profile',
      },
      documentation: {
        healthCheck: 'GET /health - Check service health status',
        register: 'POST /auth/register - Register a new user with email and password',
        login: 'POST /auth/login - Login with email and password',
        validate: 'POST /auth/validate - Validate JWT token',
        refresh: 'POST /auth/refresh - Refresh access token using refresh token',
        passwordReset: 'POST /auth/password-reset-request - Request password reset',
        passwordResetConfirm: 'POST /auth/password-reset-confirm - Confirm password reset with token',
        passwordChange: 'POST /auth/password-change - Change password for authenticated user',
        registerContact: 'POST /auth/register-contact - Register user with email/phone without password',
        loginContact: 'POST /auth/login-contact - Login with email/phone (contact-based)',
        profile: 'GET /auth/profile - Get authenticated user profile',
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Get('api')
  getApiInfo() {
    return {
      success: true,
      service: 'auth-microservice',
      apiVersion: '1.0.0',
      endpoints: [
        {
          method: 'GET',
          path: '/health',
          description: 'Health check endpoint',
          response: {
            success: true,
            status: 'ok',
            timestamp: 'ISO 8601 string',
            service: 'auth-microservice',
          },
        },
        {
          method: 'POST',
          path: '/auth/register',
          description: 'Register a new user with email and password',
          contentType: 'application/json',
          requestBody: {
            email: 'string (required) - user email address',
            password: 'string (required) - user password',
            username: 'string (optional) - username',
          },
          response: {
            success: true,
            data: {
              user: 'user object',
              accessToken: 'JWT access token',
              refreshToken: 'JWT refresh token',
            },
          },
        },
        {
          method: 'POST',
          path: '/auth/login',
          description: 'Login with email and password',
          contentType: 'application/json',
          requestBody: {
            email: 'string (required) - user email address',
            password: 'string (required) - user password',
          },
          response: {
            success: true,
            data: {
              user: 'user object',
              accessToken: 'JWT access token',
              refreshToken: 'JWT refresh token',
            },
          },
        },
        {
          method: 'POST',
          path: '/auth/validate',
          description: 'Validate JWT token',
          contentType: 'application/json',
          requestBody: {
            token: 'string (required) - JWT token to validate',
          },
          response: {
            valid: 'boolean',
            user: 'user object if valid',
          },
        },
        {
          method: 'POST',
          path: '/auth/refresh',
          description: 'Refresh access token using refresh token',
          contentType: 'application/json',
          requestBody: {
            refreshToken: 'string (required) - refresh token',
          },
          response: {
            success: true,
            data: {
              accessToken: 'new JWT access token',
              refreshToken: 'new JWT refresh token',
            },
          },
        },
        {
          method: 'POST',
          path: '/auth/password-reset-request',
          description: 'Request password reset',
          contentType: 'application/json',
          requestBody: {
            email: 'string (required) - user email address',
          },
          response: {
            success: true,
            message: 'Password reset email sent',
          },
        },
        {
          method: 'POST',
          path: '/auth/password-reset-confirm',
          description: 'Confirm password reset with token',
          contentType: 'application/json',
          requestBody: {
            token: 'string (required) - password reset token',
            newPassword: 'string (required) - new password',
          },
          response: {
            success: true,
            message: 'Password reset successful',
          },
        },
        {
          method: 'POST',
          path: '/auth/password-change',
          description: 'Change password for authenticated user',
          authentication: 'JWT token required',
          contentType: 'application/json',
          requestBody: {
            currentPassword: 'string (required) - current password',
            newPassword: 'string (required) - new password',
          },
          response: {
            success: true,
            message: 'Password changed successfully',
          },
        },
        {
          method: 'POST',
          path: '/auth/register-contact',
          description: 'Register user with email/phone without password',
          contentType: 'application/json',
          requestBody: {
            type: 'email|phone (required) - contact type',
            value: 'string (required) - email address or phone number',
            username: 'string (optional) - username',
          },
          response: {
            success: true,
            data: {
              user: 'user object',
              accessToken: 'JWT access token',
              refreshToken: 'JWT refresh token',
            },
          },
        },
        {
          method: 'POST',
          path: '/auth/login-contact',
          description: 'Login with email/phone (contact-based)',
          contentType: 'application/json',
          requestBody: {
            type: 'email|phone (required) - contact type',
            value: 'string (required) - email address or phone number',
          },
          response: {
            success: true,
            data: {
              user: 'user object',
              accessToken: 'JWT access token',
              refreshToken: 'JWT refresh token',
            },
          },
        },
        {
          method: 'GET',
          path: '/auth/profile',
          description: 'Get authenticated user profile',
          authentication: 'JWT token required',
          response: {
            success: true,
            data: {
              user: 'user object',
            },
          },
        },
      ],
      timestamp: new Date().toISOString(),
    };
  }
}

