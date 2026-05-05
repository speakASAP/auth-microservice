/**
 * Auth Microservice Main Entry Point
 */

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { join } from 'path';

process.on('uncaughtException', (err) => {
  // eslint-disable-next-line no-console
  console.error('uncaughtException', err?.message, err?.stack);
});
process.on('unhandledRejection', (reason, promise) => {
  // eslint-disable-next-line no-console
  console.error('unhandledRejection', reason);
});

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const expressApp = app.getHttpAdapter().getInstance();
  const webPublicPath = join(process.cwd(), 'web', 'public');

  // Serve public landing/admin assets from the same backend process in Kubernetes.
  app.useStaticAssets(webPublicPath, { index: 'index.html' });
  expressApp.get(['/login', '/register'], (_req, res) => {
    res.sendFile(join(webPublicPath, 'index.html'));
  });
  expressApp.get('/admin', (_req, res) => {
    res.sendFile(join(webPublicPath, 'admin.html'));
  });

  // Enable CORS. When credentials is true, origin cannot be '*' (browser rejects).
  // CORS_ORIGIN supports:
  // - Explicit origins: https://logging.alfares.cz,https://notifications.alfares.cz
  // - Wildcard domains: *.alfares.cz,*.alfares.cz (any subdomain of these)
  const corsOrigin = process.env.CORS_ORIGIN?.trim() || '';
  const originEntries = corsOrigin
    ? corsOrigin.split(',').map((o) => o.trim()).filter(Boolean)
    : [];

  if (originEntries.length === 0) {
    app.enableCors({
      origin: '*',
      credentials: false,
    });
  } else {
    const exactOrigins = originEntries.filter((entry) => !entry.startsWith('*.'));
    const wildcardSuffixes = originEntries
      .filter((entry) => entry.startsWith('*.'))
      .map((entry) => entry.substring(1)); // ".alfares.cz" from "*.alfares.cz"

    app.enableCors({
      origin: (origin, callback) => {
        if (!origin) {
          callback(null, true);
          return;
        }

        if (exactOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        try {
          const url = new URL(origin);
          const hostname = url.hostname;
          const allowed = wildcardSuffixes.some((suffix) => {
            const trimmed = suffix.startsWith('.') ? suffix.slice(1) : suffix;
            return hostname === trimmed || hostname.endsWith(`.${trimmed}`);
          });
          callback(null, allowed);
        } catch {
          callback(null, false);
        }
      },
      credentials: true,
    });
  }

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

