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
        contactCodeRequest: 'POST /auth/contact-code/request',
        contactCodeVerify: 'POST /auth/contact-code/verify',
        profile: 'GET /auth/profile',
        checkoutData: 'GET /auth/profile/checkout-data',
        deliveryAddresses: 'GET/POST/PATCH/DELETE /auth/profile/delivery-addresses',
        invoiceProfiles: 'GET/POST/PATCH/DELETE /auth/profile/invoice-profiles',
      },
      documentation: {
        healthCheck: 'GET /health - Check service health status',
        register: 'POST /auth/register - Register a new user with email and password',
        login: 'POST /auth/login - Login with email or phone identifier and password',
        validate: 'POST /auth/validate - Validate JWT token',
        refresh: 'POST /auth/refresh - Refresh access token using refresh token',
        passwordReset: 'POST /auth/password-reset-request - Request password reset',
        passwordResetConfirm: 'POST /auth/password-reset-confirm - Confirm password reset with token',
        passwordChange: 'POST /auth/password-change - Change password for authenticated user',
        registerContact: 'POST /auth/register-contact - Provision contact user without issuing tokens',
        loginContact: 'POST /auth/login-contact - Deprecated: contact proof required',
        contactCodeRequest: 'POST /auth/contact-code/request - Request email/phone sign-in code',
        contactCodeVerify: 'POST /auth/contact-code/verify - Verify email/phone sign-in code',
        profile: 'GET /auth/profile - Get authenticated user profile',
        checkoutData: 'GET /auth/profile/checkout-data - Get Auth-owned profile, delivery addresses, invoice profiles, and defaults for checkout forms',
        deliveryAddresses: 'GET/POST/PATCH/DELETE /auth/profile/delivery-addresses - Manage Auth-owned delivery address book',
        invoiceProfiles: 'GET/POST/PATCH/DELETE /auth/profile/invoice-profiles - Manage Auth-owned invoice and billing profiles',
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
          description: 'Provision or update a contact user without authenticating them',
          contentType: 'application/json',
          requestBody: {
            name: 'string (required) - display name',
            contactInfo: 'array (required) - email/phone contacts',
            source: 'string (optional) - source application, e.g. marathon',
            sessionId: 'string (optional) - legacy compatibility metadata only',
          },
          response: {
            success: true,
            userId: 'canonical auth user id',
            authenticated: false,
            provisioning: true,
            user: 'sanitized user object',
          },
        },
        {
          method: 'POST',
          path: '/auth/login-contact',
          description: 'Deprecated contact lookup endpoint. Never issues tokens without verified proof.',
          contentType: 'application/json',
          requestBody: {
            type: 'email|phone (required) - contact type',
            value: 'string (required) - email address or phone number',
          },
          response: {
            error: '401 unless a verified Auth-owned proof flow is used',
          },
        },
        {
          method: 'POST',
          path: '/auth/contact-code/request',
          description: 'Request a 6-digit email or phone sign-in code. Does not issue tokens.',
          contentType: 'application/json',
          requestBody: {
            identifier: 'string (required) - email address or phone number',
            return_url: 'string (required) - validated HTTPS callback URL',
            client_id: 'string (optional) - caller id',
            state: 'string (optional) - caller state',
          },
          response: {
            success: true,
            delivery: 'sent|accepted',
          },
        },
        {
          method: 'GET',
          path: '/auth/profile/checkout-data',
          description: 'Get authenticated user profile plus Auth-owned delivery addresses, invoice profiles, and defaults',
          authentication: 'JWT token required',
          response: {
            user: 'sanitized Auth user object',
            deliveryAddresses: 'delivery address array',
            invoiceProfiles: 'invoice profile array',
            defaults: {
              deliveryAddressId: 'default delivery address id or null',
              invoiceProfileId: 'default invoice profile id or null',
            },
          },
        },
        {
          method: 'GET|POST|PATCH|DELETE',
          path: '/auth/profile/delivery-addresses',
          description: 'Manage authenticated user delivery address book entries in Auth',
          authentication: 'JWT token required',
        },
        {
          method: 'GET|POST|PATCH|DELETE',
          path: '/auth/profile/invoice-profiles',
          description: 'Manage authenticated user invoice and billing profiles in Auth',
          authentication: 'JWT token required',
        },
        {
          method: 'POST',
          path: '/auth/contact-code/verify',
          description: 'Verify a 6-digit email or phone code and return the standard JWT contract.',
          contentType: 'application/json',
          requestBody: {
            identifier: 'string (required) - email address or phone number',
            code: 'string (required) - 6-digit code',
            return_url: 'string (optional) - callback override',
          },
          response: {
            user: 'sanitized user object',
            accessToken: 'JWT access token',
            refreshToken: 'JWT refresh token',
            redirectUrl: 'return_url with token fragment handoff',
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
