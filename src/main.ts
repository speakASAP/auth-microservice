/**
 * Auth Microservice Main Entry Point
 */

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS. When credentials is true, origin cannot be '*' (browser rejects).
  // Use comma-separated CORS_ORIGIN for admin logins from logging/notifications/database-server.
  const corsOrigin = process.env.CORS_ORIGIN?.trim() || '';
  const origins = corsOrigin ? corsOrigin.split(',').map((o) => o.trim()).filter(Boolean) : [];
  app.enableCors({
    origin: origins.length > 0 ? origins : '*',
    credentials: origins.length > 0,
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = parseInt(process.env.PORT || '3370', 10);
  const nodeEnv = process.env.NODE_ENV || 'development';
  await app.listen(port);

  // eslint-disable-next-line no-console
  console.log('========================================');
  // eslint-disable-next-line no-console
  console.log('Auth Microservice Started');
  // eslint-disable-next-line no-console
  console.log('========================================');
  // eslint-disable-next-line no-console
  console.log(`Environment: ${nodeEnv}`);
  // eslint-disable-next-line no-console
  console.log(`Port: ${port}`);
  // eslint-disable-next-line no-console
  console.log(`Health Check: http://localhost:${port}/health`);
  // eslint-disable-next-line no-console
  console.log(`API Endpoint: http://localhost:${port}/auth`);
  // eslint-disable-next-line no-console
  console.log('========================================');
}

bootstrap();

