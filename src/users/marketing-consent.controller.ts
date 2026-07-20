/**
 * Marketing consent HTTP surface.
 *
 * The authenticated routes always act on req.user.id — never on a userId taken
 * from the body — so one user cannot alter another's consent.
 */

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MarketingConsentService, MARKETING_PRODUCTS } from './marketing-consent.service';
import { UnsubscribeTokenService } from './unsubscribe-token.service';
import { MarketingProduct } from './entities/user-marketing-consent.entity';

function assertProduct(value: unknown): MarketingProduct {
  if (typeof value !== 'string' || !MARKETING_PRODUCTS.includes(value as MarketingProduct)) {
    throw new BadRequestException(`Unknown marketing product: ${String(value)}`);
  }
  return value as MarketingProduct;
}

@Controller('auth/marketing-consents')
export class MarketingConsentController {
  constructor(
    private readonly consentService: MarketingConsentService,
    private readonly tokenService: UnsubscribeTokenService,
  ) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async list(@Request() req: any) {
    const live = await this.consentService.getLive(req.user.id);

    const consents: Record<string, boolean> = {};
    const versions: Record<string, string | null> = {};
    for (const product of MARKETING_PRODUCTS) {
      const row = live.find((item) => item.product === product);
      consents[product] = Boolean(row);
      versions[product] = row ? row.documentVersion : null;
    }

    return { consents, versions };
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async grant(@Request() req: any, @Body() body: any) {
    const product = assertProduct(body?.product);
    if (typeof body?.documentVersion !== 'string' || !body.documentVersion.trim()) {
      throw new BadRequestException('documentVersion is required');
    }

    await this.consentService.grant(
      req.user.id,
      product,
      body.documentVersion,
      req.ip ?? null,
      req.headers?.['user-agent'] ?? null,
    );

    return { ok: true };
  }

  @Delete(':product')
  @UseGuards(JwtAuthGuard)
  async revoke(@Request() req: any, @Param('product') productParam: string) {
    const product = assertProduct(productParam);
    await this.consentService.revoke(req.user.id, product);
    return { ok: true };
  }

  // Public on purpose — withdrawal must be as easy as granting.
  @Post('unsubscribe')
  async unsubscribe(@Body() body: any) {
    const claims = this.tokenService.verify(body?.token);
    if (!claims) {
      throw new BadRequestException('Invalid or expired unsubscribe link');
    }

    await this.consentService.revoke(claims.userId, claims.product);
    return { ok: true, product: claims.product };
  }
}
