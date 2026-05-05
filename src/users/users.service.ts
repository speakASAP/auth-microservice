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

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { phone } });
  }

  async findByContact(type: string, value: string): Promise<User | null> {
    // Search in contactInfo JSONB field
    return this.userRepository
      .createQueryBuilder('user')
      .where(`user.contactInfo @> :contact`, {
        contact: JSON.stringify([{ type, value }]),
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
}

