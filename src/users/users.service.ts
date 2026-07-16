/**
 * Users Service
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, IsNull, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { UserDeliveryAddress } from './entities/user-delivery-address.entity';
import { UserInvoiceProfile } from './entities/user-invoice-profile.entity';
import { LegacyIdentityMapping } from './entities/legacy-identity-mapping.entity';
import { MagicLinkToken } from '../auth/entities/magic-link-token.entity';
import { PasswordResetToken } from '../auth/entities/password-reset-token.entity';
import { UserRole } from '../user-roles/entities/user-role.entity';
import { Application } from '../applications/entities/application.entity';
import { UpdateUserMarketingPreferencesDto } from '../auth/dto/update-user-marketing-preferences.dto';

export type AdminUserApplicationSummary = {
  id: string;
  name: string;
  displayName: string | null;
  roles: string[];
};

export type AdminUserListItem = Pick<User, 'id' | 'email' | 'firstName' | 'lastName' | 'phone' | 'isActive' | 'isVerified' | 'userType' | 'createdAt' | 'updatedAt'> & {
  applications?: AdminUserApplicationSummary[];
  adminApplications?: AdminUserApplicationSummary[];
};

export type AdminUserListFilters = {
  search?: string;
  applicationId?: string;
  status?: 'active' | 'inactive';
  verified?: 'yes' | 'no';
  adminOnly?: boolean;
};

export type AdminApplicationAdminsSummary = {
  application: Pick<Application, 'id' | 'name' | 'displayName' | 'type' | 'isActive'>;
  admins: Array<Pick<User, 'id' | 'email' | 'firstName' | 'lastName'> & { roles: string[] }>;
};

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(UserDeliveryAddress)
    private readonly deliveryAddressRepository: Repository<UserDeliveryAddress>,
    @InjectRepository(UserInvoiceProfile)
    private readonly invoiceProfileRepository: Repository<UserInvoiceProfile>,
    @InjectRepository(LegacyIdentityMapping)
    private readonly legacyIdentityMappingRepository: Repository<LegacyIdentityMapping>,
  ) {}

  async findLegacyMapping(legacySystem: string, legacyUserId: number): Promise<{ authUserId: string | null; normalizedEmail: string | null } | null> {
    const mapping = await this.legacyIdentityMappingRepository.findOne({
      where: { legacySystem, legacyUserId },
    });
    if (!mapping) return null;
    return { authUserId: mapping.authUserId ?? null, normalizedEmail: mapping.normalizedEmail ?? null };
  }

  async findByEmail(email: string): Promise<User | null> {
    const normalizedEmail = this.normalizeEmail(email);
    if (!normalizedEmail) {
      return null;
    }

    return this.userRepository.createQueryBuilder('user').where('LOWER(user.email) = :email', { email: normalizedEmail }).getOne();
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

  async findAdminListPage(limit: number, offset: number, filters: AdminUserListFilters = {}): Promise<[AdminUserListItem[], number]> {
    const query = this.userRepository.createQueryBuilder('user').select(['user.id', 'user.email', 'user.firstName', 'user.lastName', 'user.phone', 'user.isActive', 'user.isVerified', 'user.userType', 'user.createdAt', 'user.updatedAt']).orderBy('user.createdAt', 'DESC').take(limit).skip(offset);

    const search = (filters.search || '').trim().toLowerCase();
    if (search) {
      query.andWhere(
        new Brackets((qb) => {
          qb.where("LOWER(COALESCE(user.email, '')) LIKE :search", {
            search: `%${search}%`,
          })
            .orWhere("LOWER(COALESCE(user.firstName, '')) LIKE :search", {
              search: `%${search}%`,
            })
            .orWhere("LOWER(COALESCE(user.lastName, '')) LIKE :search", {
              search: `%${search}%`,
            })
            .orWhere("LOWER(COALESCE(user.phone, '')) LIKE :search", {
              search: `%${search}%`,
            })
            .orWhere("LOWER(COALESCE(user.userType, '')) LIKE :search", {
              search: `%${search}%`,
            });
        }),
      );
    }

    if (filters.status === 'active') {
      query.andWhere('user.isActive = :isActive', { isActive: true });
    } else if (filters.status === 'inactive') {
      query.andWhere('user.isActive = :isActive', { isActive: false });
    }

    if (filters.verified === 'yes') {
      query.andWhere('user.isVerified = :isVerified', { isVerified: true });
    } else if (filters.verified === 'no') {
      query.andWhere('user.isVerified = :isVerified', { isVerified: false });
    }

    if (filters.applicationId) {
      query.andWhere(
        `EXISTS (
          SELECT 1
          FROM user_roles ur
          WHERE ur."userId" = "user"."id"
          AND ur."applicationId" = :applicationId
          AND (ur."expiresAt" IS NULL OR ur."expiresAt" > NOW())
        )`,
        { applicationId: filters.applicationId },
      );
    }

    if (filters.adminOnly) {
      const adminApplicationClause = filters.applicationId ? 'AND ur."applicationId" = :adminApplicationId' : '';
      query.andWhere(
        `EXISTS (
          SELECT 1
          FROM user_roles ur
          INNER JOIN roles role ON role.id = ur."roleId"
          WHERE ur."userId" = "user"."id"
          AND ur."applicationId" IS NOT NULL
          ${adminApplicationClause}
          AND LOWER(role.name) LIKE :adminRoleName
          AND (ur."expiresAt" IS NULL OR ur."expiresAt" > NOW())
        )`,
        { adminRoleName: '%admin%', adminApplicationId: filters.applicationId },
      );
    }

    const [users, count] = await query.getManyAndCount();
    const enrichedUsers = await this.attachAdminApplicationSummaries(users);
    return [enrichedUsers, count];
  }

  async findApplicationAdmins(): Promise<AdminApplicationAdminsSummary[]> {
    const applications = await this.userRepository.manager.getRepository(Application).find({
      select: {
        id: true,
        name: true,
        displayName: true,
        type: true,
        isActive: true,
      },
      order: { name: 'ASC' },
    });

    const userRoles = await this.userRepository.manager.getRepository(UserRole).find({
      relations: ['user', 'role', 'application'],
    });

    const now = Date.now();
    const adminsByApplication = new Map<
      string,
      Map<
        string,
        Pick<User, 'id' | 'email' | 'firstName' | 'lastName'> & {
          roles: string[];
        }
      >
    >();
    userRoles.forEach((userRole) => {
      if (!userRole.applicationId || !userRole.user || !userRole.role || !this.isAdminRoleName(userRole.role.name) || (userRole.expiresAt && userRole.expiresAt.getTime() <= now)) {
        return;
      }

      if (!adminsByApplication.has(userRole.applicationId)) {
        adminsByApplication.set(userRole.applicationId, new Map());
      }

      const appAdmins = adminsByApplication.get(userRole.applicationId);
      let admin = appAdmins.get(userRole.userId);
      if (!admin) {
        admin = {
          id: userRole.user.id,
          email: userRole.user.email,
          firstName: userRole.user.firstName,
          lastName: userRole.user.lastName,
          roles: [],
        };
        appAdmins.set(userRole.userId, admin);
      }

      if (!admin.roles.includes(userRole.role.name)) {
        admin.roles.push(userRole.role.name);
      }
    });

    return applications.map((application) => ({
      application,
      admins: Array.from(adminsByApplication.get(application.id)?.values() || []).sort((a, b) => (a.email || a.id).localeCompare(b.email || b.id)),
    }));
  }

  private async attachAdminApplicationSummaries(users: User[]): Promise<AdminUserListItem[]> {
    if (users.length === 0) {
      return [];
    }

    const userIds = users.map((user) => user.id);
    const userRoles = await this.userRepository.manager.getRepository(UserRole).find({
      where: { userId: In(userIds) },
      relations: ['role', 'application'],
    });

    const now = Date.now();
    const appsByUser = new Map<string, Map<string, AdminUserApplicationSummary>>();
    const adminAppsByUser = new Map<string, Map<string, AdminUserApplicationSummary>>();
    userRoles.forEach((userRole) => {
      if (!userRole.applicationId || !userRole.application || (userRole.expiresAt && userRole.expiresAt.getTime() <= now)) {
        return;
      }

      this.addUserApplicationSummary(appsByUser, userRole);
      if (this.isAdminRoleName(userRole.role?.name)) {
        this.addUserApplicationSummary(adminAppsByUser, userRole);
      }
    });

    return users.map((user) => ({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      isActive: user.isActive,
      isVerified: user.isVerified,
      userType: user.userType,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      applications: this.sortedApplicationSummaries(appsByUser.get(user.id)),
      adminApplications: this.sortedApplicationSummaries(adminAppsByUser.get(user.id)),
    }));
  }

  private addUserApplicationSummary(target: Map<string, Map<string, AdminUserApplicationSummary>>, userRole: UserRole): void {
    if (!target.has(userRole.userId)) {
      target.set(userRole.userId, new Map());
    }

    const userApps = target.get(userRole.userId);
    let appSummary = userApps.get(userRole.applicationId);
    if (!appSummary) {
      appSummary = {
        id: userRole.applicationId,
        name: userRole.application.name,
        displayName: userRole.application.displayName || null,
        roles: [],
      };
      userApps.set(userRole.applicationId, appSummary);
    }

    const roleName = userRole.role?.name;
    if (roleName && !appSummary.roles.includes(roleName)) {
      appSummary.roles.push(roleName);
    }
  }

  private sortedApplicationSummaries(apps?: Map<string, AdminUserApplicationSummary>): AdminUserApplicationSummary[] {
    return Array.from(apps?.values() || []).sort((a, b) => a.name.localeCompare(b.name));
  }

  private isAdminRoleName(roleName?: string): boolean {
    return Boolean(roleName && roleName.toLowerCase().includes('admin'));
  }

  async delete(id: string): Promise<void> {
    const manager = this.userRepository.manager;
    await manager.transaction(async (tx) => {
      await tx.delete(MagicLinkToken, { userId: id });
      await tx.delete(PasswordResetToken, { userId: id });
      await tx.delete(UserRole, { userId: id });
      await tx.delete(UserDeliveryAddress, { userId: id });
      await tx.delete(UserInvoiceProfile, { userId: id });
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
      select: ['id', 'preferredChannel', 'fallbackChannels', 'perApplicationPreferences', 'perBrandPreferences', 'marketingConsents', 'transactionalOnly', 'unsubscribedAt', 'updatedAt'],
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

  async listDeliveryAddresses(userId: string): Promise<UserDeliveryAddress[]> {
    return this.deliveryAddressRepository.find({
      where: { userId, deletedAt: IsNull() },
      order: { isDefault: 'DESC', updatedAt: 'DESC' },
    });
  }

  async getDeliveryAddress(userId: string, addressId: string): Promise<UserDeliveryAddress> {
    return this.findDeliveryAddressForUser(userId, addressId);
  }

  async createDeliveryAddress(userId: string, input: Partial<UserDeliveryAddress>): Promise<UserDeliveryAddress> {
    const existingCount = await this.deliveryAddressRepository.count({
      where: { userId, deletedAt: IsNull() },
    });
    const patch = this.cleanDeliveryAddressInput(input);
    const shouldDefault = input.isDefault === true || existingCount === 0;

    if (shouldDefault) {
      await this.clearDefaultDeliveryAddress(userId);
    }

    const address = this.deliveryAddressRepository.create({
      ...patch,
      userId,
      isDefault: shouldDefault,
    });

    return this.deliveryAddressRepository.save(address);
  }

  async updateDeliveryAddress(userId: string, addressId: string, input: Partial<UserDeliveryAddress>): Promise<UserDeliveryAddress> {
    const address = await this.findDeliveryAddressForUser(userId, addressId);
    const patch = this.cleanDeliveryAddressInput(input);

    if (input.isDefault === true) {
      await this.clearDefaultDeliveryAddress(userId);
      patch.isDefault = true;
    } else if (input.isDefault === false) {
      patch.isDefault = false;
    }

    if (Object.keys(patch).length === 0) {
      return address;
    }

    await this.deliveryAddressRepository.update(address.id, patch);
    return this.findDeliveryAddressForUser(userId, address.id);
  }

  async deleteDeliveryAddress(userId: string, addressId: string): Promise<void> {
    const address = await this.findDeliveryAddressForUser(userId, addressId);
    await this.deliveryAddressRepository.update(address.id, {
      isDefault: false,
      deletedAt: new Date(),
    });
  }

  async setDefaultDeliveryAddress(userId: string, addressId: string): Promise<UserDeliveryAddress> {
    const address = await this.findDeliveryAddressForUser(userId, addressId);
    await this.clearDefaultDeliveryAddress(userId);
    await this.deliveryAddressRepository.update(address.id, {
      isDefault: true,
    });
    return this.findDeliveryAddressForUser(userId, address.id);
  }

  async listInvoiceProfiles(userId: string): Promise<UserInvoiceProfile[]> {
    return this.invoiceProfileRepository.find({
      where: { userId, deletedAt: IsNull() },
      order: { isDefault: 'DESC', updatedAt: 'DESC' },
    });
  }

  async getInvoiceProfile(userId: string, profileId: string): Promise<UserInvoiceProfile> {
    return this.findInvoiceProfileForUser(userId, profileId);
  }

  async createInvoiceProfile(userId: string, input: Partial<UserInvoiceProfile>): Promise<UserInvoiceProfile> {
    const existingCount = await this.invoiceProfileRepository.count({
      where: { userId, deletedAt: IsNull() },
    });
    const patch = this.cleanInvoiceProfileInput(input);
    const shouldDefault = input.isDefault === true || existingCount === 0;

    if (shouldDefault) {
      await this.clearDefaultInvoiceProfile(userId);
    }

    const profile = this.invoiceProfileRepository.create({
      ...patch,
      userId,
      type: patch.type || 'person',
      isDefault: shouldDefault,
    });

    return this.invoiceProfileRepository.save(profile);
  }

  async updateInvoiceProfile(userId: string, profileId: string, input: Partial<UserInvoiceProfile>): Promise<UserInvoiceProfile> {
    const profile = await this.findInvoiceProfileForUser(userId, profileId);
    const patch = this.cleanInvoiceProfileInput(input);

    if (input.isDefault === true) {
      await this.clearDefaultInvoiceProfile(userId);
      patch.isDefault = true;
    } else if (input.isDefault === false) {
      patch.isDefault = false;
    }

    if (Object.keys(patch).length === 0) {
      return profile;
    }

    await this.invoiceProfileRepository.update(profile.id, patch);
    return this.findInvoiceProfileForUser(userId, profile.id);
  }

  async deleteInvoiceProfile(userId: string, profileId: string): Promise<void> {
    const profile = await this.findInvoiceProfileForUser(userId, profileId);
    await this.invoiceProfileRepository.update(profile.id, {
      isDefault: false,
      deletedAt: new Date(),
    });
  }

  async setDefaultInvoiceProfile(userId: string, profileId: string): Promise<UserInvoiceProfile> {
    const profile = await this.findInvoiceProfileForUser(userId, profileId);
    await this.clearDefaultInvoiceProfile(userId);
    await this.invoiceProfileRepository.update(profile.id, { isDefault: true });
    return this.findInvoiceProfileForUser(userId, profile.id);
  }

  private async findDeliveryAddressForUser(userId: string, addressId: string): Promise<UserDeliveryAddress> {
    const address = await this.deliveryAddressRepository.findOne({
      where: { id: addressId, userId, deletedAt: IsNull() },
    });

    if (!address) {
      throw new NotFoundException('Delivery address not found');
    }

    return address;
  }

  private async findInvoiceProfileForUser(userId: string, profileId: string): Promise<UserInvoiceProfile> {
    const profile = await this.invoiceProfileRepository.findOne({
      where: { id: profileId, userId, deletedAt: IsNull() },
    });

    if (!profile) {
      throw new NotFoundException('Invoice profile not found');
    }

    return profile;
  }

  private async clearDefaultDeliveryAddress(userId: string): Promise<void> {
    await this.deliveryAddressRepository.update({ userId, deletedAt: IsNull(), isDefault: true }, { isDefault: false });
  }

  private async clearDefaultInvoiceProfile(userId: string): Promise<void> {
    await this.invoiceProfileRepository.update({ userId, deletedAt: IsNull(), isDefault: true }, { isDefault: false });
  }

  private cleanDeliveryAddressInput(input: Partial<UserDeliveryAddress>): Partial<UserDeliveryAddress> {
    const patch: Partial<UserDeliveryAddress> = {};
    this.assignCleanString(patch, 'label', input.label);
    this.assignCleanString(patch, 'firstName', input.firstName);
    this.assignCleanString(patch, 'lastName', input.lastName);
    this.assignCleanString(patch, 'company', input.company);
    this.assignCleanString(patch, 'street', input.street);
    this.assignCleanString(patch, 'street2', input.street2);
    this.assignCleanString(patch, 'city', input.city);
    this.assignCleanString(patch, 'region', input.region);
    this.assignCleanString(patch, 'postalCode', input.postalCode);
    this.assignCleanString(patch, 'country', input.country);
    this.assignCleanString(patch, 'phone', input.phone, true);
    this.assignCleanString(patch, 'email', input.email, false, true);
    this.assignCleanString(patch, 'deliveryInstructions', input.deliveryInstructions);
    this.assignCleanString(patch, 'sourceApplication', input.sourceApplication);
    return patch;
  }

  private cleanInvoiceProfileInput(input: Partial<UserInvoiceProfile>): Partial<UserInvoiceProfile> {
    const patch: Partial<UserInvoiceProfile> = {};
    this.assignCleanString(patch, 'label', input.label);
    if (input.type === 'person' || input.type === 'company') {
      patch.type = input.type;
    }
    this.assignCleanString(patch, 'firstName', input.firstName);
    this.assignCleanString(patch, 'lastName', input.lastName);
    this.assignCleanString(patch, 'companyName', input.companyName);
    this.assignCleanString(patch, 'companyId', input.companyId);
    this.assignCleanString(patch, 'taxId', input.taxId);
    this.assignCleanString(patch, 'vatId', input.vatId);
    this.assignCleanString(patch, 'street', input.street);
    this.assignCleanString(patch, 'street2', input.street2);
    this.assignCleanString(patch, 'city', input.city);
    this.assignCleanString(patch, 'region', input.region);
    this.assignCleanString(patch, 'postalCode', input.postalCode);
    this.assignCleanString(patch, 'country', input.country);
    this.assignCleanString(patch, 'phone', input.phone, true);
    this.assignCleanString(patch, 'email', input.email, false, true);
    this.assignCleanString(patch, 'sourceApplication', input.sourceApplication);
    return patch;
  }

  private assignCleanString<T extends object>(patch: T, key: keyof T, value: unknown, normalizePhone = false, lowerCase = false): void {
    const cleaned = this.cleanNullableString(value);
    if (cleaned === undefined) {
      return;
    }

    const nextValue = cleaned && normalizePhone ? this.normalizePhone(cleaned) || null : cleaned && lowerCase ? cleaned.toLowerCase() : cleaned;
    patch[key] = nextValue as T[keyof T];
  }

  private cleanNullableString(value: unknown): string | null | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value === null) {
      return null;
    }

    const cleaned = String(value).trim();
    return cleaned.length ? cleaned : null;
  }

  private normalizeEmail(email: string): string {
    return (email || '').trim().toLowerCase();
  }

  private normalizePhone(phone: string): string {
    return (phone || '').trim().replace(/[^0-9+]/g, '');
  }
}
