/**
 * Users Service
 */

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { MagicLinkToken } from '../auth/entities/magic-link-token.entity';
import { PasswordResetToken } from '../auth/entities/password-reset-token.entity';
import { UserRole } from '../user-roles/entities/user-role.entity';
import { UpdateUserMarketingPreferencesDto } from '../auth/dto/update-user-marketing-preferences.dto';

export type AdminUserListItem = Pick<
  User,
  'id' | 'email' | 'firstName' | 'lastName' | 'phone' | 'isActive' | 'isVerified' | 'userType' | 'createdAt' | 'updatedAt'
>;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    const normalizedEmail = this.normalizeEmail(email);
    if (!normalizedEmail) {
      return null;
    }

    return this.userRepository
      .createQueryBuilder('user')
      .where('LOWER(user.email) = :email', { email: normalizedEmail })
      .getOne();
  }

  async findByPhone(phone: string): Promise<User | null> {
    const normalizedPhone = this.normalizePhone(phone);
    if (!normalizedPhone) {
      return null;
    }

    return this.userRepository
      .createQueryBuilder('user')
      .where("regexp_replace(COALESCE(user.phone, ''), '[^0-9+]', '', 'g') = :phone", {
        phone: normalizedPhone,
      })
      .orWhere(
        `EXISTS (
          SELECT 1
          FROM jsonb_array_elements(COALESCE(user.contactInfo, '[]'::jsonb)) AS contact
          WHERE contact->>'type' = 'phone'
          AND regexp_replace(COALESCE(contact->>'value', ''), '[^0-9+]', '', 'g') = :phone
        )`,
        { phone: normalizedPhone },
      )
      .getOne();
  }

  async findByContact(type: string, value: string): Promise<User | null> {
    if (type === 'email') {
      return this.findByEmail(value);
    }
    if (type === 'phone') {
      return this.findByPhone(value);
    }

    const normalizedValue = (value || '').trim();
    if (!type || !normalizedValue) {
      return null;
    }

    return this.userRepository
      .createQueryBuilder('user')
      .where(`user.contactInfo @> :contact`, {
        contact: JSON.stringify([{ type, value: normalizedValue }]),
      })
      .getOne();
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  async create(userData: Partial<User>): Promise<User> {
    const user = this.userRepository.create(userData);
    return this.userRepository.save(user);
  }

  async update(id: string, userData: Partial<User>): Promise<User> {
    await this.userRepository.update(id, userData);
    return this.findById(id);
  }

  async updatePassword(id: string, hashedPassword: string): Promise<User> {
    await this.userRepository.update(id, { password: hashedPassword });
    return this.findById(id);
  }

  async findAll(): Promise<User[]> {
    return this.userRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findAdminListPage(limit: number, offset: number): Promise<[AdminUserListItem[], number]> {
    return this.userRepository.findAndCount({
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        isActive: true,
        isVerified: true,
        userType: true,
        createdAt: true,
        updatedAt: true,
      },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  async delete(id: string): Promise<void> {
    const manager = this.userRepository.manager;
    await manager.transaction(async (tx) => {
      await tx.delete(MagicLinkToken, { userId: id });
      await tx.delete(PasswordResetToken, { userId: id });
      await tx.delete(UserRole, { userId: id });
      await tx.delete(User, id);
    });
  }

  async toggleActive(id: string): Promise<User> {
    const user = await this.findById(id);
    if (!user) {
      throw new Error('User not found');
    }
    await this.userRepository.update(id, { isActive: !user.isActive });
    return this.findById(id);
  }

  async getMarketingPreferences(userId: string): Promise<Partial<User> | null> {
    return this.userRepository.findOne({
      where: { id: userId },
      select: [
        'id',
        'preferredChannel',
        'fallbackChannels',
        'perApplicationPreferences',
        'perBrandPreferences',
        'marketingConsents',
        'transactionalOnly',
        'unsubscribedAt',
        'updatedAt',
      ],
    });
  }

  async updateMarketingPreferences(userId: string, dto: UpdateUserMarketingPreferencesDto): Promise<User | null> {
    const updatePayload: Partial<User> = {};
    if (Object.prototype.hasOwnProperty.call(dto, 'preferredChannel')) {
      updatePayload.preferredChannel = dto.preferredChannel ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(dto, 'fallbackChannels')) {
      updatePayload.fallbackChannels = dto.fallbackChannels ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(dto, 'perApplicationPreferences')) {
      updatePayload.perApplicationPreferences = dto.perApplicationPreferences ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(dto, 'perBrandPreferences')) {
      updatePayload.perBrandPreferences = dto.perBrandPreferences ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(dto, 'marketingConsents')) {
      updatePayload.marketingConsents = dto.marketingConsents ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(dto, 'transactionalOnly')) {
      updatePayload.transactionalOnly = dto.transactionalOnly ?? null;
    }
    if (dto.unsubscribedAt !== undefined) {
      updatePayload.unsubscribedAt = dto.unsubscribedAt ? new Date(dto.unsubscribedAt) : null;
    }
    await this.userRepository.update(userId, updatePayload);
    return this.findById(userId);
  }

  private normalizeEmail(email: string): string {
    return (email || '').trim().toLowerCase();
  }

  private normalizePhone(phone: string): string {
    return (phone || '').trim().replace(/[^0-9+]/g, '');
  }
}
