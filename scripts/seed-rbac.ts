#!/usr/bin/env ts-node
/**
 * RBAC Seed Script
 * Initializes RBAC system with applications, roles, and initial user assignments
 *
 * Usage: ts-node scripts/seed-rbac.ts [--admin-email=your@email.com]
 */

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

  // Infrastructure services
  { name: 'auth-microservice', displayName: 'Auth Microservice', type: ApplicationType.INFRASTRUCTURE },
  { name: 'nginx-microservice', displayName: 'Nginx Microservice', type: ApplicationType.INFRASTRUCTURE },
  { name: 'database-server', displayName: 'Database Server', type: ApplicationType.INFRASTRUCTURE },
];

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

    for (const appDef of APPLICATIONS) {
      try {
        const app = await applicationsService.registerOrUpdate({
          name: appDef.name,
          displayName: appDef.displayName,
          type: appDef.type,
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
