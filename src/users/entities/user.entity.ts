/**
 * User Entity
 */

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, nullable: true })
  email: string;

  @Column({ nullable: true })
  password: string; // Nullable for contact-based users

  @Column({ nullable: true })
  firstName: string;

  @Column({ nullable: true })
  lastName: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ type: 'jsonb', nullable: true })
  contactInfo: Array<{ type: string; value: string; isPrimary?: boolean }>; // For contact-based registration

  @Column({ nullable: true })
  name: string; // For contact-based registration

  @Column({ nullable: true })
  source: string; // Registration source

  @Column({ nullable: true })
  sessionId: string; // Compatibility metadata for provisioned contact users; not an auth session

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isVerified: boolean;

  @Column({ type: 'varchar', length: 50, default: 'end_user' })
  userType: string; // 'end_user' | 'staff' | 'service' | 'admin'

  @Column({ type: 'timestamp', nullable: true })
  lastActivity: Date;

  @Column({ type: 'varchar', length: 20, nullable: true })
  preferredChannel: string | null;

  @Column({ type: 'text', array: true, nullable: true })
  fallbackChannels: string[] | null;

  @Column({ type: 'jsonb', nullable: true })
  perApplicationPreferences: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  perBrandPreferences: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  marketingConsents: Record<string, unknown> | null;

  @Column({ type: 'boolean', nullable: true })
  transactionalOnly: boolean | null;

  @Column({ type: 'timestamp', nullable: true })
  unsubscribedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

