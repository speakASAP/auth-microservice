#!/usr/bin/env ts-node
/**
 * RBAC Seed Script
 * Initializes RBAC system with applications, roles, and initial user assignments
 *
 * Usage: ts-node scripts/seed-rbac.ts [--admin-email=your@email.com]
 * Run from auth-microservice dir. For local DB use: DB_HOST=127.0.0.1 ./scripts/seed-rbac.sh ...
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import { existsSync, readdirSync, readFileSync } from 'fs';

// Load .env from auth-microservice root so DB credentials are available before Nest bootstraps
config({ path: resolve(__dirname, '..', '.env') });

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ApplicationsService } from '../src/applications/applications.service';
import { RolesService } from '../src/roles/roles.service';
import { UsersService } from '../src/users/users.service';
import { ApplicationType } from '../src/applications/entities/application.entity';
import { RoleScope } from '../src/roles/entities/role.entity';

// Application definitions - maps SERVICE_NAME to application config
const APPLICATIONS = [
  // User-facing applications
  { name: 'shop-assistant', displayName: 'Shop Assistant', type: ApplicationType.USER_FACING },
  { name: 'beauty', displayName: 'Beauty', type: ApplicationType.USER_FACING },
  { name: 'crypto-ai-agent', displayName: 'Crypto AI Agent', type: ApplicationType.USER_FACING },
  { name: 'marathon', displayName: 'Marathon', type: ApplicationType.USER_FACING },
  { name: 'flipflop-service', displayName: 'FlipFlop Service', type: ApplicationType.USER_FACING },
  { name: 'allegro-service', displayName: 'Allegro Service', type: ApplicationType.USER_FACING },
  { name: 'aukro-service', displayName: 'Aukro Service', type: ApplicationType.USER_FACING },
  { name: 'heureka-service', displayName: 'Heureka Service', type: ApplicationType.USER_FACING },
  { name: 'bazos-service', displayName: 'Bazos Service', type: ApplicationType.USER_FACING },
  { name: 'statex', displayName: 'Statex', type: ApplicationType.USER_FACING },
  { name: 'messenger', displayName: 'Messenger', type: ApplicationType.USER_FACING },
  { name: 'speakasap', displayName: 'SpeakASAP', type: ApplicationType.USER_FACING },
  { name: 'sgiprealestate', displayName: 'SGIP Real Estate', type: ApplicationType.USER_FACING },
  { name: 'business-orchestrator', displayName: 'Business Orchestrator', type: ApplicationType.USER_FACING },
  { name: 'ecosystem-console', displayName: 'Ecosystem Console', type: ApplicationType.USER_FACING },
  { name: 'task-management', displayName: 'Task Management', type: ApplicationType.USER_FACING },
  { name: 'leads-microservice', displayName: 'Leads Microservice', type: ApplicationType.USER_FACING },

  // Internal microservices
  { name: 'ai-microservice', displayName: 'AI Microservice', type: ApplicationType.INTERNAL },
  { name: 'logging-microservice', displayName: 'Logging Microservice', type: ApplicationType.INTERNAL },
  { name: 'notifications-microservice', displayName: 'Notifications Microservice', type: ApplicationType.INTERNAL },
  { name: 'payments-microservice', displayName: 'Payments Microservice', type: ApplicationType.INTERNAL },
  { name: 'catalog-microservice', displayName: 'Catalog Microservice', type: ApplicationType.INTERNAL },
  { name: 'warehouse-microservice', displayName: 'Warehouse Microservice', type: ApplicationType.INTERNAL },
  { name: 'suppliers-microservice', displayName: 'Suppliers Microservice', type: ApplicationType.INTERNAL },
  { name: 'orders-microservice', displayName: 'Orders Microservice', type: ApplicationType.INTERNAL },
  { name: 'prompts-microservice', displayName: 'Prompts Microservice', type: ApplicationType.INTERNAL },
  { name: 'marketing-microservice', displayName: 'Marketing Microservice', type: ApplicationType.INTERNAL },

  // Infrastructure services
  { name: 'auth-microservice', displayName: 'Auth Microservice', type: ApplicationType.INFRASTRUCTURE },
  { name: 'nginx-microservice', displayName: 'Nginx Microservice', type: ApplicationType.INFRASTRUCTURE },
  { name: 'database-server', displayName: 'Database Server', type: ApplicationType.INFRASTRUCTURE },
];

type AppSeedRecord = {
  name: string;
  displayName: string;
  type: ApplicationType;
  domain?: string;
};

function toDisplayName(serviceName: string): string {
  return serviceName
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function inferType(serviceName: string): ApplicationType {
  if (serviceName === 'auth-microservice' || serviceName === 'nginx-microservice' || serviceName === 'database-server') {
    return ApplicationType.INFRASTRUCTURE;
  }
  if (serviceName.endsWith('-microservice')) {
    return ApplicationType.INTERNAL;
  }
  return ApplicationType.USER_FACING;
}

function discoverApplicationsFromRegistry(): AppSeedRecord[] {
  const registryCandidates = [
    process.env.NGINX_SERVICE_REGISTRY_DIR,
    resolve(__dirname, '../../nginx-microservice/service-registry'),
    '/home/statex/nginx-microservice/service-registry',
    '/home/alfares/nginx-microservice/service-registry',
  ].filter((candidate): candidate is string => Boolean(candidate));

  const registryDir = registryCandidates.find((candidate) => existsSync(candidate));
  if (!registryDir) {
    return [];
  }

  const discovered: AppSeedRecord[] = [];
  const files = readdirSync(registryDir).filter((file) => file.endsWith('.json'));

  for (const fileName of files) {
    try {
      const raw = readFileSync(resolve(registryDir, fileName), 'utf8');
      const parsed = JSON.parse(raw);
      const serviceName = String(parsed.service_name || '').trim();
      if (!serviceName) {
        continue;
      }

      const domain = parsed.domain ? String(parsed.domain).trim() : undefined;
      discovered.push({
        name: serviceName,
        displayName: toDisplayName(serviceName),
        type: inferType(serviceName),
        domain,
      });
    } catch (error) {
      console.warn(`Skipping invalid registry file: ${fileName}`, (error as Error).message);
    }
  }

  return discovered;
}

// Predefined roles
const PREDEFINED_ROLES = [
  // Global roles
  { name: 'superadmin', scope: RoleScope.GLOBAL, description: 'Full platform access - superuser' },
  { name: 'platform_admin', scope: RoleScope.GLOBAL, description: 'Platform administration access' },

  // Application roles (will be created per application)
  { name: 'user', scope: RoleScope.APPLICATION, description: 'Standard user role for applications' },
  { name: 'admin', scope: RoleScope.APPLICATION, description: 'Admin role for applications' },

  // Internal service roles (will be created per internal service)
  { name: 'admin', scope: RoleScope.INTERNAL, description: 'Admin access to internal services' },
];

async function seedRBAC(adminEmail?: string) {
  console.log('🌱 Starting RBAC seed...\n');

  const app = await NestFactory.createApplicationContext(AppModule);
  const applicationsService = app.get(ApplicationsService);
  const rolesService = app.get(RolesService);
  const usersService = app.get(UsersService);

  try {
    // Step 1: Register applications
    console.log('📦 Registering applications...');
    const registeredApps: Map<string, any> = new Map();

    const discoveredApps = discoverApplicationsFromRegistry();
    const appSeedMap = new Map<string, AppSeedRecord>();

    for (const appDef of APPLICATIONS) {
      appSeedMap.set(appDef.name, { ...appDef });
    }
    for (const discovered of discoveredApps) {
      const existing = appSeedMap.get(discovered.name);
      if (existing) {
        appSeedMap.set(discovered.name, {
          ...existing,
          domain: discovered.domain || existing.domain,
        });
      } else {
        appSeedMap.set(discovered.name, discovered);
      }
    }

    const applicationsToSeed = Array.from(appSeedMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    console.log(`📚 Applications from static list: ${APPLICATIONS.length}, discovered from nginx registry: ${discoveredApps.length}`);

    for (const appDef of applicationsToSeed) {
      try {
        const app = await applicationsService.registerOrUpdate({
          name: appDef.name,
          displayName: appDef.displayName,
          type: appDef.type,
          domain: appDef.domain,
        });
        registeredApps.set(appDef.name, app);
        console.log(`  ✅ Registered: ${appDef.name} (${appDef.type})`);
      } catch (error: any) {
        if (error.message?.includes('already exists')) {
          console.log(`  ⏭️  Skipped (exists): ${appDef.name}`);
          const existing = await applicationsService.findByName(appDef.name);
          if (existing) {
            registeredApps.set(appDef.name, existing);
          }
        } else {
          console.error(`  ❌ Failed: ${appDef.name} - ${error.message}`);
        }
      }
    }

    console.log(`\n✅ Registered ${registeredApps.size} applications\n`);

    // Step 2: Create predefined roles
    console.log('🔐 Creating predefined roles...');
    const createdRoles: Map<string, any> = new Map();

    // Create global roles
    for (const roleDef of PREDEFINED_ROLES.filter((r) => r.scope === RoleScope.GLOBAL)) {
      try {
        const role = await rolesService.create({
          name: roleDef.name,
          scope: roleDef.scope,
          description: roleDef.description,
        });
        createdRoles.set(`global:${roleDef.name}`, role);
        console.log(`  ✅ Created: global:${roleDef.name}`);
      } catch (error: any) {
        if (error.message?.includes('already exists')) {
          console.log(`  ⏭️  Skipped (exists): global:${roleDef.name}`);
          const existing = await rolesService.findByName(roleDef.name, RoleScope.GLOBAL);
          if (existing) {
            createdRoles.set(`global:${roleDef.name}`, existing);
          }
        } else {
          console.error(`  ❌ Failed: global:${roleDef.name} - ${error.message}`);
        }
      }
    }

    // Create application roles for each user-facing app
    for (const [appName, app] of registeredApps.entries()) {
      if (app.type === ApplicationType.USER_FACING) {
        for (const roleDef of PREDEFINED_ROLES.filter((r) => r.scope === RoleScope.APPLICATION)) {
          const roleKey = `app:${appName}:${roleDef.name}`;
          try {
            const role = await rolesService.create({
              name: roleDef.name,
              scope: RoleScope.APPLICATION,
              applicationId: app.id,
              description: `${roleDef.description} for ${app.displayName}`,
            });
            createdRoles.set(roleKey, role);
            console.log(`  ✅ Created: ${roleKey}`);
          } catch (error: any) {
            if (error.message?.includes('already exists')) {
              console.log(`  ⏭️  Skipped (exists): ${roleKey}`);
            } else {
              console.error(`  ❌ Failed: ${roleKey} - ${error.message}`);
            }
          }
        }
      }
    }

    // Create internal service roles for each internal service
    for (const [appName, app] of registeredApps.entries()) {
      if (app.type === ApplicationType.INTERNAL) {
        for (const roleDef of PREDEFINED_ROLES.filter((r) => r.scope === RoleScope.INTERNAL)) {
          const roleKey = `internal:${appName}:${roleDef.name}`;
          try {
            const role = await rolesService.create({
              name: roleDef.name,
              scope: RoleScope.INTERNAL,
              applicationId: app.id,
              description: `${roleDef.description} for ${app.displayName}`,
            });
            createdRoles.set(roleKey, role);
            console.log(`  ✅ Created: ${roleKey}`);
          } catch (error: any) {
            if (error.message?.includes('already exists')) {
              console.log(`  ⏭️  Skipped (exists): ${roleKey}`);
            } else {
              console.error(`  ❌ Failed: ${roleKey} - ${error.message}`);
            }
          }
        }
      }
    }

    console.log(`\n✅ Created roles\n`);

    // Step 3: Assign superadmin role to admin user
    if (adminEmail) {
      console.log(`👤 Assigning superadmin role to ${adminEmail}...`);
      try {
        const user = await usersService.findByEmail(adminEmail);
        if (!user) {
          console.error(`  ❌ User not found: ${adminEmail}`);
          console.log(`  💡 Create user first or use existing email`);
        } else {
          const superadminRole = createdRoles.get('global:superadmin');
          if (superadminRole) {
            try {
              await rolesService.assignRoleToUser(user.id, superadminRole.id);
              console.log(`  ✅ Assigned superadmin role to ${adminEmail}`);
            } catch (error: any) {
              if (error.message?.includes('already assigned')) {
                console.log(`  ⏭️  Role already assigned to ${adminEmail}`);
              } else {
                console.error(`  ❌ Failed to assign role: ${error.message}`);
              }
            }
          } else {
            console.error(`  ❌ Superadmin role not found`);
          }
        }
      } catch (error: any) {
        console.error(`  ❌ Error: ${error.message}`);
      }
    } else {
      console.log(`  ⏭️  Skipped: No admin email provided`);
      console.log(`  💡 Run with --admin-email=your@email.com to assign superadmin role`);
    }

    console.log(`\n✅ RBAC seed completed successfully!\n`);
    console.log(`📋 Summary:`);
    console.log(`  - Applications: ${registeredApps.size}`);
    console.log(`  - Roles: ${createdRoles.size}`);
    if (adminEmail) {
      console.log(`  - Admin user: ${adminEmail}`);
    }
  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  } finally {
    await app.close();
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
let adminEmail: string | undefined;

for (const arg of args) {
  if (arg.startsWith('--admin-email=')) {
    adminEmail = arg.split('=')[1];
  }
}

// Run seed
seedRBAC(adminEmail)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
