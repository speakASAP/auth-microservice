/**
 * Users Module
 */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { UserDeliveryAddress } from './entities/user-delivery-address.entity';
import { UserInvoiceProfile } from './entities/user-invoice-profile.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserDeliveryAddress, UserInvoiceProfile])],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
