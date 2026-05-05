import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class InternalServiceGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const token = req.headers['x-internal-service-token'];
    const serviceName = String(req.headers['x-service-name'] || '').trim();
    const expectedToken = process.env.INTERNAL_SERVICE_TOKEN || '';
    const trustedServices = (process.env.TRUSTED_INTERNAL_SERVICES || '')
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    if (!expectedToken || token !== expectedToken) {
      throw new UnauthorizedException('Invalid internal service token');
    }

    if (trustedServices.length > 0 && !trustedServices.includes(serviceName)) {
      throw new UnauthorizedException('Service is not trusted');
    }

    return true;
  }
}
