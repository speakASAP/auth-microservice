/**
 * HMAC unsubscribe tokens.
 *
 * Unauthenticated by design: GDPR requires withdrawal to be as easy as
 * granting, and demanding a login from an e-mail link fails that test.
 *
 * TTL is 12 months because the link must still work in an archived message.
 */

import { Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { MarketingProduct } from './entities/user-marketing-consent.entity';
import { MARKETING_PRODUCTS } from './marketing-consent.service';

const TTL_SECONDS = 365 * 24 * 3600;

@Injectable()
export class UnsubscribeTokenService {
  private readonly logger = new Logger(UnsubscribeTokenService.name);

  private secret(): string {
    const value = process.env.MARKETING_UNSUBSCRIBE_SECRET;
    if (!value) {
      throw new Error('MARKETING_UNSUBSCRIBE_SECRET is not configured');
    }
    return value;
  }

  private sign(payload: string): string {
    return createHmac('sha256', this.secret()).update(payload).digest('base64url');
  }

  mint(userId: string, product: MarketingProduct): string {
    const expiry = Math.floor(Date.now() / 1000) + TTL_SECONDS;
    const payload = `${userId}|${product}|${expiry}`;
    const encoded = Buffer.from(payload).toString('base64url');
    return `${encoded}.${this.sign(payload)}`;
  }

  verify(token: string): { userId: string; product: MarketingProduct } | null {
    if (!token || !token.includes('.')) return null;

    const [encoded, signature] = token.split('.');
    if (!encoded || !signature) return null;

    let payload: string;
    try {
      payload = Buffer.from(encoded, 'base64url').toString('utf8');
    } catch {
      return null;
    }

    const parts = payload.split('|');
    if (parts.length !== 3) return null;
    const [userId, product, expiryRaw] = parts;

    if (!MARKETING_PRODUCTS.includes(product as MarketingProduct)) return null;

    const expected = Buffer.from(this.sign(payload));
    const provided = Buffer.from(signature);
    if (expected.length !== provided.length) return null;
    if (!timingSafeEqual(expected, provided)) return null;

    const expiry = Number(expiryRaw);
    if (!Number.isFinite(expiry) || expiry * 1000 < Date.now()) return null;

    return { userId, product: product as MarketingProduct };
  }
}
