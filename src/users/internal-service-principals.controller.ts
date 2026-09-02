import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { InternalServiceGuard } from '../auth/guards/internal-service.guard';
import { ServicePrincipalsService } from './service-principals.service';

/**
 * Inventory feed for the credential prober in monitoring-microservice.
 *
 * An endpoint rather than a direct auth-DB read from monitoring: the inventory
 * shape is a contract this service owns, and handing out auth DB credentials to
 * widen the blast radius of the most sensitive database is a poor trade for one
 * read.
 *
 * Returns identity and role metadata only — never a token, secret, or password
 * hash. The prober needs to know which credentials exist, not what they are.
 */
@Controller('internal/service-principals')
@UseGuards(InternalServiceGuard)
export class InternalServicePrincipalsController {
  constructor(private readonly servicePrincipals: ServicePrincipalsService) {}

  @Get()
  async list(@Query('includeInactive') includeInactive?: string) {
    const principals = await this.servicePrincipals.listServicePrincipals(
      includeInactive === 'true',
    );

    return {
      count: principals.length,
      // Surfaced at the top level so a consumer sees the ambiguity without
      // walking the list. Both are expected to be non-zero today, and a prober
      // that ignores them will probe the wrong receivers.
      offConventionCount: principals.filter((p) => !p.onConvention).length,
      targetMismatchCount: principals.filter((p) => p.targetMismatch).length,
      principals,
    };
  }
}
