/**
 * Marketing consent record.
 *
 * Rows are immutable evidence. Withdrawal stamps revokedAt; nothing is ever
 * deleted, because the published privacy policy relies on an auditable history
 * of who consented to which version of the text and when.
 */

import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type MarketingProduct = 'speakasap' | 'marathon' | 'bazos';

@Entity('user_marketing_consents')
@Index(['userId', 'product', 'revokedAt'])
export class UserMarketingConsent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  userId: string;

  // Matches campaign.appId in marketing-microservice, never campaign.tenantId.
  @Column({ type: 'varchar', length: 50 })
  product: MarketingProduct;

  @Column({ type: 'varchar', length: 100 })
  documentVersion: string;

  @Column({ type: 'timestamp', default: () => 'now()' })
  grantedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  revokedAt: Date | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  ip: string | null;

  @Column({ type: 'text', nullable: true })
  userAgent: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
