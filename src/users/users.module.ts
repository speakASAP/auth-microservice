/**
 * Users Module
 */

import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
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
import { ServicePrincipalsService } from './service-principals.service';
import { InternalServicePrincipalsController } from './internal-service-principals.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserDeliveryAddress, UserInvoiceProfile, LegacyIdentityMapping, UserMarketingConsent]),
    // Circular by nature: AuthModule needs UsersService to look users up, and
    // InternalUsersController needs AuthService to mint a session for one it resolved.
    forwardRef(() => AuthModule),
  ],
  controllers: [InternalUsersController, MarketingConsentController, InternalServicePrincipalsController],
  providers: [UsersService, MarketingConsentService, UnsubscribeTokenService, ServicePrincipalsService],
  exports: [UsersService, MarketingConsentService, UnsubscribeTokenService, ServicePrincipalsService],
})
export class UsersModule {}
