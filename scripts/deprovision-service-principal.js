#!/usr/bin/env node
/**
 * Sole service-principal deprovisioner — the reverse of
 * `provision-service-token.js`. Follow
 * auth-microservice/docs/SERVICE_IDENTITY_CONSUMER_STANDARD.md; do not invent
 * alternate removal scripts or delete rows by hand in psql.
 *
 * Runs inside the auth pod against compiled `dist/`.
 *
 * Retirement is two stages, and this script only performs the second:
 *
 *   1. DEACTIVATE (`isActive=false`). `/auth/validate` rejects an inactive
 *      principal, so this alone stops every token it ever signed. It is
 *      reversible and is the stage that actually closes the access.
 *   2. DELETE. Removes the row and its role bindings for good. Irreversible,
 *      and only ever appropriate for a principal that is already deactivated,
 *      holds no live credential, and is referenced by nothing.
 *
 * A principal is only safe to delete when ALL of these hold, and the script
 * refuses unless it can confirm the first three itself:
 *   - it is already `isActive=false`
 *   - it was deactivated at least --min-age-days ago (default 7)
 *   - every role it holds is held by at least one OTHER active principal, so
 *     deleting it cannot orphan a role that nothing else can grant
 *   - no Vault key still stores a token for it (verify separately; the auth
 *     pod cannot read Vault)
 *
 * Inspect (no writes, safe against production at any time):
 *   kubectl exec -n statex-apps deploy/auth-microservice -c app -- \
 *     node scripts/deprovision-service-principal.js \
 *     --email=svc-old--target@internal.alfares.cz --check-db-only
 *
 * List every principal that currently qualifies:
 *   ... --list-eligible
 *
 * Dry run a deletion:
 *   ... --email=svc-old--target@internal.alfares.cz --dry-run
 *
 * Apply:
 *   ... --email=svc-old--target@internal.alfares.cz --apply \
 *     --confirm-db-mutation=DELETE_SERVICE_PRINCIPAL
 */

const CONTRACT = 'auth-service-principal-deprovisioning.v1';
const DEFAULT_MIN_AGE_DAYS = 7;

function fail(message) {
  console.log(JSON.stringify({ contract: CONTRACT, status: 'failed', error: message }, null, 2));
  process.exit(1);
}

function arg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
}

function flag(name) {
  return process.argv.includes(`--${name}`);
}

/**
 * A service principal, never a human account. Deleting a human user through
 * this script is out of scope and refused: the address shapes below are the
 * machine-identity namespaces, and `@gmail.com` and friends never match.
 */
function isServicePrincipalEmail(email) {
  return (
    /@internal\.alfares\.cz$/.test(email) ||
    /@internal\.alfares$/.test(email) ||
    /@internal\.alfares\.(invalid|local)$/.test(email) ||
    /@internal\.invalid$/.test(email) ||
    /@internal$/.test(email) ||
    /@alfares\.cz$/.test(email)
  );
}

async function main() {
  if (flag('help')) {
    console.log(require('fs').readFileSync(__filename, 'utf8').split('*/')[0]);
    process.exit(0);
  }

  const email = arg('email');
  const listEligible = flag('list-eligible');
  const checkDbOnly = flag('check-db-only');
  const dryRun = flag('dry-run');
  const apply = flag('apply');
  const minAgeDays = Number.parseInt(arg('min-age-days') || String(DEFAULT_MIN_AGE_DAYS), 10);

  if (!listEligible && !email) fail('--email is required (or use --list-eligible)');
  if (apply && arg('confirm-db-mutation') !== 'DELETE_SERVICE_PRINCIPAL') {
    fail('--apply requires --confirm-db-mutation=DELETE_SERVICE_PRINCIPAL');
  }
  if (apply && dryRun) fail('--apply and --dry-run are mutually exclusive');
  if (!Number.isFinite(minAgeDays) || minAgeDays < 0) fail('--min-age-days must be a non-negative integer');
  if (email && !isServicePrincipalEmail(email)) {
    fail(`Refusing: ${email} is not a service-principal address. This script never deletes human accounts.`);
  }

  const { NestFactory } = require('@nestjs/core');
  const { AppModule } = require('../dist/src/app.module');
  const { UsersService } = require('../dist/src/users/users.service');
  const { RolesService } = require('../dist/src/roles/roles.service');

  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  try {
    const usersService = app.get(UsersService);
    const rolesService = app.get(RolesService);
    const dataSource = app.get(require('typeorm').DataSource);

    // Role bindings are read straight from the join table: a role is "shared"
    // when at least one OTHER active user holds the same roleId. Deleting a
    // principal that is the last holder of a role would leave that role
    // grantable by nobody, which is a silent capability loss.
    const sharedRoleCheck = async (userId) => {
      const rows = await dataSource.query(
        `SELECT r.id, r.name, r.description,
                (SELECT count(*) FROM user_roles ur2
                   JOIN users u2 ON u2.id = ur2."userId"
                  WHERE ur2."roleId" = r.id AND u2."isActive" = true) AS active_holders
           FROM user_roles ur
           JOIN roles r ON r.id = ur."roleId"
          WHERE ur."userId" = $1`,
        [userId],
      );
      return rows.map((r) => ({
        role: r.name,
        description: r.description,
        otherActiveHolders: Number(r.active_holders),
      }));
    };

    const evaluate = async (user) => {
      const roles = await sharedRoleCheck(user.id);
      const deactivatedAt = user.updatedAt ? new Date(user.updatedAt) : null;
      const ageDays = deactivatedAt
        ? Math.floor((Date.now() - deactivatedAt.getTime()) / 86400000)
        : null;

      const blockers = [];
      if (user.isActive) blockers.push('principal is still active — deactivate first, never delete a live principal');
      if (ageDays !== null && ageDays < minAgeDays) {
        blockers.push(`deactivated ${ageDays}d ago, below --min-age-days=${minAgeDays}`);
      }
      const orphaned = roles.filter((r) => r.otherActiveHolders === 0);
      for (const r of orphaned) {
        blockers.push(`role "${r.description}" would be left with no active holder`);
      }
      return { roles, ageDays, blockers, eligible: blockers.length === 0 };
    };

    if (listEligible) {
      const candidates = await dataSource.query(
        `SELECT id, email, "isActive", "updatedAt" FROM users
          WHERE "isActive" = false ORDER BY email`,
      );
      const out = [];
      for (const c of candidates) {
        if (!isServicePrincipalEmail(c.email)) continue;
        const verdict = await evaluate(c);
        out.push({
          email: c.email,
          deactivatedDaysAgo: verdict.ageDays,
          eligible: verdict.eligible,
          blockers: verdict.blockers,
          roles: verdict.roles.map((r) => `${r.description} (other active holders: ${r.otherActiveHolders})`),
        });
      }
      console.log(JSON.stringify({
        contract: CONTRACT,
        mode: 'list-eligible',
        mutatesDatabase: false,
        minAgeDays,
        total: out.length,
        eligible: out.filter((o) => o.eligible).length,
        principals: out,
      }, null, 2));
      return;
    }

    const user = await usersService.findByEmail(email);
    if (!user) {
      console.log(JSON.stringify({
        contract: CONTRACT,
        mode: checkDbOnly ? 'check-db-only' : dryRun ? 'dry-run' : 'apply',
        mutatesDatabase: false,
        principal: null,
        status: 'not-found',
        note: 'Nothing to deprovision — no principal with that address.',
      }, null, 2));
      return;
    }

    const verdict = await evaluate(user);
    const base = {
      contract: CONTRACT,
      principal: { id: user.id, email: user.email, isActive: user.isActive },
      deactivatedDaysAgo: verdict.ageDays,
      minAgeDays,
      roles: verdict.roles.map((r) => `${r.description} (other active holders: ${r.otherActiveHolders})`),
      eligible: verdict.eligible,
      blockers: verdict.blockers,
      reminder: 'Confirm no Vault key still stores a token for this principal before deleting.',
    };

    if (checkDbOnly || dryRun) {
      console.log(JSON.stringify({
        ...base,
        mode: checkDbOnly ? 'check-db-only' : 'dry-run',
        mutatesDatabase: false,
        wouldDelete: verdict.eligible,
        status: verdict.eligible ? 'ready-for-owner-approval' : 'blocked',
      }, null, 2));
      return;
    }

    if (!apply) fail('Specify one of --check-db-only, --dry-run, --list-eligible or --apply');
    if (!verdict.eligible) {
      fail(`Refusing to delete ${email}: ${verdict.blockers.join('; ')}`);
    }

    // UsersService.delete removes the role bindings and the user row in one
    // transaction, so a partial delete cannot leave dangling grants.
    await usersService.delete(user.id);

    const stillThere = await usersService.findByEmail(email);
    if (stillThere) fail(`Delete reported success but ${email} is still present — investigate before retrying.`);

    console.log(JSON.stringify({
      ...base,
      mode: 'apply',
      mutatesDatabase: true,
      deleted: true,
      status: 'ok',
    }, null, 2));
  } finally {
    await app.close();
  }
}

main().catch((err) => fail(err?.message ?? String(err)));
