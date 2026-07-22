/**
 * Marketing consent, Art. 6(1)(a) GDPR.
 *
 * The table is the source of truth. users.marketingConsents is a projection
 * kept in sync so marketing-microservice's existing gate keeps working with no
 * change to its reader.
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import {
  UserMarketingConsent,
  MarketingProduct,
} from './entities/user-marketing-consent.entity';
import { User } from './entities/user.entity';

export const MARKETING_PRODUCTS: readonly MarketingProduct[] = ['speakasap', 'marathon', 'bazos'];

@Injectable()
export class MarketingConsentService {
  private readonly logger = new Logger(MarketingConsentService.name);

  constructor(
    @InjectRepository(UserMarketingConsent)
    private readonly consentRepository: Repository<UserMarketingConsent>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async getLive(userId: string, product?: MarketingProduct): Promise<UserMarketingConsent[]> {
    return this.consentRepository.find({
      where: product
        ? { userId, product, revokedAt: IsNull() }
        : { userId, revokedAt: IsNull() },
    });
  }

  async grant(
    userId: string,
    product: MarketingProduct,
    documentVersion: string,
    ip: string | null = null,
    userAgent: string | null = null,
  ): Promise<UserMarketingConsent> {
    const live = await this.getLive(userId, product);

    const sameVersion = live.find((row) => row.documentVersion === documentVersion);
    if (sameVersion) {
      return sameVersion;
    }

    // A version change revokes the old evidence and records fresh evidence,
    // so the history shows exactly which text was agreed to and when.
    for (const row of live) {
      row.revokedAt = new Date();
      await this.consentRepository.save(row);
    }

    const created = this.consentRepository.create({
      userId,
      product,
      documentVersion,
      grantedAt: new Date(),
      revokedAt: null,
      ip,
      userAgent,
    });
    const saved = await this.consentRepository.save(created);

    await this.refreshProjection(userId);
    this.logger.log(
      `[MarketingConsentService] grant() outcome=granted product=${product} version=${documentVersion}`,
    );
    return saved;
  }

  async revoke(userId: string, product: MarketingProduct): Promise<void> {
    const live = await this.getLive(userId, product);
    for (const row of live) {
      row.revokedAt = new Date();
      await this.consentRepository.save(row);
    }

    await this.refreshProjection(userId);
    this.logger.log(
      `[MarketingConsentService] revoke() outcome=revoked product=${product} rows=${live.length}`,
    );
  }

  /**
   * Rewrites users.marketingConsents as { <appId>: boolean }.
   *
   * The key MUST be the product (campaign.appId). Keying on tenantId would be
   * "statex" and would grant consent across every app in the ecosystem.
   *
   * This deliberately does not touch unsubscribedAt or transactionalOnly:
   * sources.ts treats those as GLOBAL suppression, so setting either on a
   * per-product withdrawal would silently kill the other product too.
   */
  private async refreshProjection(userId: string): Promise<void> {
    const live = await this.getLive(userId);
    const granted = new Set(live.map((row) => row.product));

    const projection: Record<string, boolean> = {};
    for (const product of MARKETING_PRODUCTS) {
      projection[product] = granted.has(product);
    }

    await this.userRepository.update(userId, { marketingConsents: projection });
  }
}
