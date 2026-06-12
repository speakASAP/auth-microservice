/**
 * Legacy Identity Mapping Entity
 *
 * Auth-owned bridge from legacy application user IDs to auth-microservice users.
 * Used by migration dry runs and approved bootstrap flows; does not make
 * downstream services identity owners.
 */

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { User } from './user.entity';

export enum LegacyIdentityMappingStatus {
  MAPPED = 'mapped',
  CREATED = 'created',
  SKIPPED_DUPLICATE_EMAIL = 'skipped_duplicate_email',
  SKIPPED_BLANK_EMAIL = 'skipped_blank_email',
  SKIPPED_CONFLICT = 'skipped_conflict',
  SKIPPED_UNUSABLE = 'skipped_unusable',
}

@Entity('legacy_identity_mappings')
@Unique(['legacySystem', 'legacyUserId'])
@Index(['legacySystem', 'normalizedEmail'])
@Index(['authUserId'])
export class LegacyIdentityMapping {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  legacySystem: string;

  @Column({ type: 'int' })
  legacyUserId: number;

  @Column({ type: 'uuid', nullable: true })
  authUserId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'authUserId' })
  authUser: User | null;

  @Column({ nullable: true })
  normalizedEmail: string | null;

  @Column({ type: 'varchar', length: 80 })
  status: LegacyIdentityMappingStatus;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'jsonb', nullable: true })
  sourceSnapshot: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
