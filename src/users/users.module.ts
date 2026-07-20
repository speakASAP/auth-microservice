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
import { UserMarketingConsent } from './entities/user-marketing-consent.entity';
import { MarketingConsentService } from './marketing-consent.service';
import { UnsubscribeTokenService } from './unsubscribe-token.service';
import { MarketingConsentController } from './marketing-consent.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserDeliveryAddress, UserInvoiceProfile, LegacyIdentityMapping, UserMarketingConsent])],
  controllers: [InternalUsersController, MarketingConsentController],
  providers: [UsersService, MarketingConsentService, UnsubscribeTokenService],
  exports: [UsersService, MarketingConsentService, UnsubscribeTokenService],
})
export class UsersModule {}
