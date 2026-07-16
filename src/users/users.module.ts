/**
 * Users Module
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { InternalUsersController } from './internal-users.controller';
import { User } from './entities/user.entity';
import { UserDeliveryAddress } from './entities/user-delivery-address.entity';
import { UserInvoiceProfile } from './entities/user-invoice-profile.entity';
import { LegacyIdentityMapping } from './entities/legacy-identity-mapping.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserDeliveryAddress, UserInvoiceProfile, LegacyIdentityMapping])],
  controllers: [InternalUsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
