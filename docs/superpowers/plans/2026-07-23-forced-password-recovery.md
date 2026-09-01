---
status: review
owner: repository-owner
last_updated: 2026-08-31
---

# Forced Password Recovery After One-Time-Code Login — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A user who forgot their password recovers in one continuous flow — request recovery, enter the emailed code, set a new password — and lands on the page they originally wanted, already signed in.

**Architecture:** An OTP requested with `purpose: 'recovery'` cannot be exchanged for application tokens. It buys only a short-lived, single-use grant row in `password_reset_tokens` that authorizes exactly one action: set a password. Completing that action mints the tokens and performs the existing handoff to `return_url`. Enforcement lives entirely in auth-microservice, before handoff, so no consuming application changes.

**Tech Stack:** NestJS 10, TypeORM (Postgres, `DB_SYNC=false`, no migration runner — schema changes are manual SQL), Jest, and a static hosted frontend (`web/public/index.html` served by an Express shim in `web/server.js`).

**Spec:** `docs/superpowers/specs/2026-07-23-forced-password-recovery-design.md`

## Global Constraints

- **One TTL variable.** `AUTH_PASSWORD_RECOVERY_TTL_MINUTES`, default `15`, governs the recovery code, the code-derived grant, and the email-link grant. No other variable participates. `AUTH_MAGIC_LINK_TTL_MINUTES` stays untouched and continues to govern ordinary passwordless sign-in.
- **No lifetime literal anywhere else.** Not in the service, not in email copy, not in the frontend. Every displayed number resolves from that variable.
- **The value is shown to the user** in the recovery code email, the reset-link email, the "code sent" notice, and the set-password screen.
- **Typecheck by path, never `npx tsc`.** Use `./node_modules/.bin/tsc --noEmit -p tsconfig.json`. `npx tsc` silently runs an unrelated registry package that prints a friendly message and looks like a pass.
- **Postgres identifiers are quoted camelCase** — `"returnUrl"`, `"clientId"`, `"expiresAt"`. Unquoted names fold to lowercase and will not match the entities.
- **Additive schema changes only.** No column drops, no type narrowing on existing columns.
- **Do not deploy.** Every task stops at the deploy boundary: build, typecheck, test, commit. Deploys are serialized ecosystem-wide and are performed separately.
- **Supported languages are `en`, `cs`, `ru`.** Every user-visible string needs all three.
- **Russian plurals:** `минуту/минуты/минут` all inflect with the number. Use the invariant abbreviation `мин.`, matching the existing email copy.

---

## File Structure

**Created:**
- `src/auth/password-recovery-ttl.ts` — resolves the one TTL variable. Single responsibility, no dependencies, so the "one variable" guarantee is a greppable import rather than a convention.
- `src/auth/password-recovery-ttl.spec.ts` — tests for the above.
- `src/auth/password-recovery-flow.spec.ts` — end-to-end request → verify → confirm coverage.
- `docs/sql/2026-07-23-password-recovery-columns.sql` — the four additive columns.

**Modified:**
- `src/auth/entities/magic-link-token.entity.ts` — `purpose` column.
- `src/auth/entities/password-reset-token.entity.ts` — `returnUrl`, `clientId`, `state` columns.
- `src/auth/dto/contact-code-request.dto.ts`, `src/auth/dto/contact-code-verify.dto.ts` — `purpose` field.
- `src/auth/auth.service.ts` — recovery branches, grant minting, TTL wiring, email copy.
- `src/auth/auth-contact-code.spec.ts` — purpose isolation.
- `src/auth/hosted-auth-web.spec.ts` — new route and frontend assertions.
- `web/server.js` — `/set-password` route.
- `web/public/index.html` — recovery entry point, set-password completion, i18n interpolation.
- `.env.example`, `deploy.config.sh` — env plumbing.

---

### Task 1: The one TTL variable

A standalone resolver, so every consumer imports the same function and no caller can reintroduce a literal.

**Files:**
- Create: `src/auth/password-recovery-ttl.ts`
- Create: `src/auth/password-recovery-ttl.spec.ts`
- Modify: `src/auth/auth.service.ts` (constructor, near line 103)
- Modify: `.env.example`, `deploy.config.sh:61`

**Interfaces:**
- Consumes: nothing.
- Produces: `resolvePasswordRecoveryTtlMinutes(env?: NodeJS.ProcessEnv): number` and the instance field `private readonly passwordRecoveryTtlMinutes: number` on `AuthService`.

- [ ] **Step 1: Write the failing test**

Create `src/auth/password-recovery-ttl.spec.ts`:

```ts
import { resolvePasswordRecoveryTtlMinutes } from './password-recovery-ttl';

describe('resolvePasswordRecoveryTtlMinutes', () => {
  it('defaults to 15 minutes when unset', () => {
    expect(resolvePasswordRecoveryTtlMinutes({})).toBe(15);
  });

  it('reads the configured value', () => {
    expect(resolvePasswordRecoveryTtlMinutes({ AUTH_PASSWORD_RECOVERY_TTL_MINUTES: '7' })).toBe(7);
  });

  // A malformed value must not silently become NaN: every downstream expiry is computed from
  // this number, and NaN milliseconds produces an Invalid Date that Postgres rejects at insert,
  // taking the whole recovery flow down rather than degrading.
  it.each(['', 'abc', '0', '-5'])('falls back to 15 for the unusable value %p', (value) => {
    expect(resolvePasswordRecoveryTtlMinutes({ AUTH_PASSWORD_RECOVERY_TTL_MINUTES: value })).toBe(15);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runTestsByPath src/auth/password-recovery-ttl.spec.ts`
Expected: FAIL — `Cannot find module './password-recovery-ttl'`

- [ ] **Step 3: Write minimal implementation**

Create `src/auth/password-recovery-ttl.ts`:

```ts
/**
 * The single source of truth for every password-recovery lifetime: the recovery code, the
 * grant it buys, and the grant issued by the email-link path. Kept as its own module so the
 * "one variable" rule is enforced by imports rather than by convention.
 */

export const PASSWORD_RECOVERY_TTL_ENV = 'AUTH_PASSWORD_RECOVERY_TTL_MINUTES';
export const PASSWORD_RECOVERY_TTL_DEFAULT_MINUTES = 15;

export function resolvePasswordRecoveryTtlMinutes(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const parsed = Number(env[PASSWORD_RECOVERY_TTL_ENV]);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return PASSWORD_RECOVERY_TTL_DEFAULT_MINUTES;
  }
  return parsed;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --runTestsByPath src/auth/password-recovery-ttl.spec.ts`
Expected: PASS, 3 tests (the `it.each` counts as 4 cases)

- [ ] **Step 5: Wire it into AuthService**

In `src/auth/auth.service.ts`, add to the imports at the top of the file:

```ts
import { resolvePasswordRecoveryTtlMinutes } from './password-recovery-ttl';
```

Declare the field alongside the other private readonly config fields (near `magicLinkTtlMinutes`):

```ts
  private readonly passwordRecoveryTtlMinutes: number;
```

And in the constructor, immediately after the `this.magicLinkTtlMinutes = ...` line (currently line 103):

```ts
    this.passwordRecoveryTtlMinutes = resolvePasswordRecoveryTtlMinutes();
```

- [ ] **Step 6: Add the env plumbing**

In `.env.example`, directly after the `AUTH_MAGIC_LINK_TTL_MINUTES=` line (line 79):

```
# Lifetime of every password-recovery artefact: the emailed code, the grant it buys, and the
# grant issued by the reset link. Shown to the user in all four places it applies. Default 15.
AUTH_PASSWORD_RECOVERY_TTL_MINUTES=
```

In `deploy.config.sh:61`, add `${AUTH_PASSWORD_RECOVERY_TTL_MINUTES}` to the `configmap_vars` string, directly after `${AUTH_MAGIC_LINK_TTL_MINUTES}`. A variable missing from this list never reaches the pod and silently falls back to the default — a failure every local test still passes.

- [ ] **Step 7: Verify the wiring compiles and the suite is green**

Run: `./node_modules/.bin/tsc --noEmit -p tsconfig.json && npm test`
Expected: no TypeScript output, all tests pass

- [ ] **Step 8: Confirm the plumbing is actually present**

Run: `rtk rg -n 'AUTH_PASSWORD_RECOVERY_TTL_MINUTES' .env.example deploy.config.sh src/auth/password-recovery-ttl.ts`
Expected: three files listed. If `deploy.config.sh` is missing, the variable will not exist in production.

- [ ] **Step 9: Commit**

```bash
rtk git add src/auth/password-recovery-ttl.ts src/auth/password-recovery-ttl.spec.ts src/auth/auth.service.ts .env.example deploy.config.sh
rtk git commit -m "feat(auth): single TTL variable for password recovery"
```

---

### Task 2: Schema and entities

**Files:**
- Create: `docs/sql/2026-07-23-password-recovery-columns.sql`
- Modify: `src/auth/entities/magic-link-token.entity.ts`
- Modify: `src/auth/entities/password-reset-token.entity.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `MagicLinkToken.purpose: 'login' | 'recovery'`; `PasswordResetToken.returnUrl: string | null`, `.clientId: string | null`, `.state: string | null`.

- [ ] **Step 1: Write the SQL**

Create `docs/sql/2026-07-23-password-recovery-columns.sql`:

```sql
-- Password recovery after one-time-code login. Additive only.
-- Apply manually; auth-microservice runs with DB_SYNC=false and has no migration runner.
-- Usage: psql -h <DB_HOST> -U <DB_USER> -d auth -f docs/sql/2026-07-23-password-recovery-columns.sql

-- Distinguishes a passwordless sign-in code from a recovery code. Existing rows are logins,
-- so the default keeps their meaning and lets this run while the old build is still serving.
ALTER TABLE magic_link_tokens
  ADD COLUMN IF NOT EXISTS purpose VARCHAR(20) NOT NULL DEFAULT 'login';

-- Lets a reset grant remember where the user was going, server-side, so the completion target
-- cannot be tampered with between the email and the confirm call.
ALTER TABLE password_reset_tokens
  ADD COLUMN IF NOT EXISTS "returnUrl" TEXT NULL,
  ADD COLUMN IF NOT EXISTS "clientId" VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS state TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_magic_link_tokens_purpose
  ON magic_link_tokens(purpose);
```

- [ ] **Step 2: Update the entities**

In `src/auth/entities/magic-link-token.entity.ts`, add after the `state` column:

```ts
  @Column({ type: 'varchar', length: 20, default: 'login' })
  purpose: 'login' | 'recovery';
```

In `src/auth/entities/password-reset-token.entity.ts`, add after the `token` column:

```ts
  @Column({ type: 'text', nullable: true })
  returnUrl: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  clientId: string | null;

  @Column({ type: 'text', nullable: true })
  state: string | null;
```

- [ ] **Step 3: Verify it compiles**

Run: `./node_modules/.bin/tsc --noEmit -p tsconfig.json`
Expected: no output

- [ ] **Step 4: Verify the SQL is valid and idempotent**

Run it twice against a scratch database — the second run must be a no-op, because it will be applied by hand to production where a half-applied change is not recoverable by rerunning:

```bash
psql -h "$DB_HOST" -U "$DB_USER" -d auth_scratch -f docs/sql/2026-07-23-password-recovery-columns.sql
psql -h "$DB_HOST" -U "$DB_USER" -d auth_scratch -f docs/sql/2026-07-23-password-recovery-columns.sql
```

Expected: both runs succeed; the second prints `NOTICE: column "purpose" of relation "magic_link_tokens" already exists, skipping`.

- [ ] **Step 5: Commit**

```bash
rtk git add docs/sql/2026-07-23-password-recovery-columns.sql src/auth/entities/
rtk git commit -m "feat(auth): add recovery purpose and grant return-target columns"
```

---

### Task 3: Request a recovery code

**Files:**
- Modify: `src/auth/dto/contact-code-request.dto.ts`
- Modify: `src/auth/auth.service.ts` — `contactCodeHash` (line 1552), `sendContactCode` (line 1574), `requestContactCode` (line 1611), `getPlainEmailCopy` (line 2210)
- Test: `src/auth/auth-contact-code.spec.ts`

**Interfaces:**
- Consumes: `resolvePasswordRecoveryTtlMinutes` (Task 1), `MagicLinkToken.purpose` (Task 2).
- Produces: `contactCodeHash(identifier: string, code: string, purpose: 'login' | 'recovery'): string`; `requestContactCode` returns `{ success: true, delivery: 'sent' | 'accepted', ttlMinutes: number }`.

**Why the hash changes:** `token` is `UNIQUE` and derived deterministically from identifier + code + secret. Without `purpose` in the hash, a login code and a recovery code that happen to draw the same six digits for the same person collide on insert and the second request fails. The `'login'` case must keep producing the byte-identical legacy string so codes already in flight survive the deploy.

- [ ] **Step 1: Write the failing tests**

Append to the `describe` block in `src/auth/auth-contact-code.spec.ts`:

```ts
  it('stores a recovery code with its purpose and the recovery TTL', async () => {
    const { service, savedTokens } = makeService();
    (service as any).passwordRecoveryTtlMinutes = 9;

    const before = Date.now();
    const result = await service.requestContactCode(
      {
        identifier: 'person@example.test',
        return_url: 'https://catalog.alfares.cz/orders',
        purpose: 'recovery',
      } as any,
      '10.0.0.1',
    );

    expect(result).toEqual({ success: true, delivery: 'sent', ttlMinutes: 9 });
    expect(savedTokens).toHaveLength(1);
    expect(savedTokens[0].purpose).toBe('recovery');
    const ttlMs = new Date(savedTokens[0].expiresAt).getTime() - before;
    expect(ttlMs).toBeGreaterThan(8 * 60 * 1000);
    expect(ttlMs).toBeLessThanOrEqual(9 * 60 * 1000 + 1000);
  });

  it('defaults to a login code and the magic-link TTL', async () => {
    const { service, savedTokens } = makeService();
    (service as any).passwordRecoveryTtlMinutes = 9;

    await service.requestContactCode(
      { identifier: 'person@example.test', return_url: 'https://catalog.alfares.cz/orders' } as any,
      '10.0.0.1',
    );

    expect(savedTokens[0].purpose).toBe('login');
    const ttlMs = new Date(savedTokens[0].expiresAt).getTime() - Date.now();
    expect(ttlMs).toBeGreaterThan(14 * 60 * 1000);
  });

  it('hashes the two purposes apart so identical digits cannot collide on the unique token', () => {
    const { service } = makeService();
    const asLogin = (service as any).contactCodeHash('person@example.test', '123456', 'login');
    const asRecovery = (service as any).contactCodeHash('person@example.test', '123456', 'recovery');
    expect(asRecovery).not.toBe(asLogin);
  });

  it('keeps the legacy hash for login so codes already in flight survive the deploy', () => {
    const { service } = makeService();
    const legacy = require('crypto')
      .createHash('sha256')
      .update(`person@example.test:123456:${process.env.JWT_SECRET || 'default-secret'}`)
      .digest('hex');
    expect((service as any).contactCodeHash('person@example.test', '123456', 'login')).toBe(legacy);
  });

  it('gives nothing away about an unknown account', async () => {
    const { service, savedTokens } = makeService();
    (service as any).passwordRecoveryTtlMinutes = 9;

    const result = await service.requestContactCode(
      {
        identifier: 'nobody@example.test',
        return_url: 'https://catalog.alfares.cz/orders',
        purpose: 'recovery',
      } as any,
      '10.0.0.1',
    );

    expect(result).toEqual({ success: true, delivery: 'accepted', ttlMinutes: 9 });
    expect(savedTokens).toHaveLength(0);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --runTestsByPath src/auth/auth-contact-code.spec.ts`
Expected: FAIL — `contactCodeHash` takes two arguments, the result has no `ttlMinutes`, and `purpose` is undefined on saved tokens

- [ ] **Step 3: Add `purpose` to the request DTO**

In `src/auth/dto/contact-code-request.dto.ts`, add after the `identifier` field:

```ts
  @IsOptional()
  @IsIn(['login', 'recovery'])
  purpose?: 'login' | 'recovery';
```

`IsIn` is already imported in this file.

- [ ] **Step 4: Make the hash purpose-aware**

Replace `contactCodeHash` (`src/auth/auth.service.ts:1552`):

```ts
  private contactCodeHash(identifier: string, code: string, purpose: 'login' | 'recovery' = 'login'): string {
    // 'login' must keep producing the pre-recovery string so codes issued by the previous
    // build still verify after deploy. Only 'recovery' adds a segment.
    const scope = purpose === 'recovery' ? 'recovery:' : '';
    return crypto
      .createHash('sha256')
      .update(`${identifier}:${code}:${scope}${process.env.JWT_SECRET || 'default-secret'}`)
      .digest('hex');
  }
```

- [ ] **Step 5: Branch the request on purpose**

In `requestContactCode` (`src/auth/auth.service.ts:1611`), immediately after the `identifier` is computed and before the rate-limit calls, add:

```ts
    const purpose: 'login' | 'recovery' = dto.purpose === 'recovery' ? 'recovery' : 'login';
    const ttlMinutes = purpose === 'recovery' ? this.passwordRecoveryTtlMinutes : this.magicLinkTtlMinutes;
```

Change both rate-limit keys so recovery attempts cannot drain the login budget:

```ts
    this.checkRateLimit(`contact_code:${purpose}:ip:${ip}`, this.magicLinkRateLimitPerIp);
    this.checkRateLimit(`contact_code:${purpose}:${contactType}:${identifier}`, this.magicLinkRateLimitPerEmail);
```

Replace the token/expiry construction (currently lines 1637-1639):

```ts
    const code = this.generateContactCode();
    const token = this.contactCodeHash(identifier, code, purpose);
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
```

Add `purpose` to the `magicLinkTokenRepository.create({ ... })` payload:

```ts
      purpose,
```

Pass the purpose and TTL through to delivery:

```ts
      delivered = await this.sendContactCode(contactType, identifier, code, dto.app_domain, dto.lang, purpose, ttlMinutes);
```

Both `return` statements in this method gain `ttlMinutes`. The early return for an unknown or inactive user becomes:

```ts
      return { success: true, delivery: 'accepted' as const, ttlMinutes };
```

and the final return:

```ts
    return { success: true, delivery: delivered ? ('sent' as const) : ('accepted' as const), ttlMinutes };
```

`ttlMinutes` is a constant for all callers, so returning it on the unknown-user path discloses nothing.

- [ ] **Step 6: Give recovery its own email copy**

Change the signature of `sendContactCode` (`src/auth/auth.service.ts:1574`) to accept the new arguments:

```ts
  private async sendContactCode(
    contactType: 'email' | 'phone',
    identifier: string,
    code: string,
    appDomain?: string,
    langRaw?: string,
    purpose: 'login' | 'recovery' = 'login',
    ttlMinutes: number = this.magicLinkTtlMinutes,
  ): Promise<boolean> {
```

and replace the `contactCopy` line inside it:

```ts
    const contactCopy = this.getPlainEmailCopy(
      purpose === 'recovery' ? 'password_recovery' : 'contact_code',
      lang,
      ttlMinutes,
      undefined,
      code,
    );
```

In `getPlainEmailCopy` (`src/auth/auth.service.ts:2210`), widen the `kind` parameter to `'contact_code' | 'email_change' | 'password_recovery'` and add the new branch beside the existing `contact_code` block:

```ts
    if (kind === 'password_recovery') {
      const messages = {
        en: {
          subject: 'Alfares password recovery code',
          message: `Your Alfares password recovery code is ${code}. It expires in ${ttlMinutes} minutes. Enter it to choose a new password. If you did not ask to reset your password, ignore this message — your password has not changed.`,
        },
        cs: {
          subject: 'Kód pro obnovení hesla Alfares',
          message: `Váš kód pro obnovení hesla Alfares je ${code}. Platí ${ttlMinutes} minut. Zadejte ho a zvolte si nové heslo. Pokud jste o obnovení hesla nežádali, zprávu ignorujte — vaše heslo se nezměnilo.`,
        },
        ru: {
          subject: 'Код восстановления пароля Alfares',
          message: `Ваш код восстановления пароля Alfares: ${code}. Он действует ${ttlMinutes} мин. Введите его, чтобы задать новый пароль. Если вы не запрашивали восстановление пароля, проигнорируйте это сообщение — ваш пароль не изменился.`,
        },
      } as const;
      return messages[lang];
    }
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npm test -- --runTestsByPath src/auth/auth-contact-code.spec.ts`
Expected: PASS, including the four pre-existing tests in that file

- [ ] **Step 8: Commit**

```bash
rtk git add src/auth/dto/contact-code-request.dto.ts src/auth/auth.service.ts src/auth/auth-contact-code.spec.ts
rtk git commit -m "feat(auth): request a password-recovery code"
```

---

### Task 4: Verify a recovery code into a grant

**Files:**
- Modify: `src/auth/dto/contact-code-verify.dto.ts`
- Modify: `src/auth/auth.service.ts` — `verifyContactCode` (line 1684)
- Test: `src/auth/auth-contact-code.spec.ts`

**Interfaces:**
- Consumes: `contactCodeHash(identifier, code, purpose)` (Task 3), `PasswordResetToken.returnUrl/.clientId/.state` (Task 2).
- Produces: `mintPasswordRecoveryGrant(userId: string, target: { returnUrl: string; clientId: string | null; state: string | null }): Promise<string>` returning the raw grant token, and `buildSetPasswordUrl(token: string, lang: 'en' | 'cs' | 'ru'): string`. Task 6 calls both.

- [ ] **Step 1: Write the failing tests**

Append to `src/auth/auth-contact-code.spec.ts`. Note the harness needs a `passwordResetTokenRepository` stub, which `makeService` does not yet provide — add it inside `makeService` beside `magicLinkTokenRepository`, and return `savedGrants` from the function:

```ts
    const savedGrants: any[] = [];
    service.passwordResetTokenRepository = {
      create: jest.fn((payload: any) => ({ id: 'grant-1', ...payload })),
      save: jest.fn(async (grant: any) => {
        savedGrants.push(grant);
        return grant;
      }),
      findOne: jest.fn(async ({ where }: any) => savedGrants.find((g) => g.token === where.token && g.used === where.used) || null),
    };
```

Change the final line of `makeService` to `return { service: service as AuthService, usersService, savedTokens, savedGrants, rolesService };`, then add the tests:

```ts
  it('exchanges a recovery code for a grant and issues no tokens', async () => {
    const { service, savedGrants } = makeService();
    (service as any).passwordRecoveryTtlMinutes = 9;
    process.env.FRONTEND_URL = 'https://auth.alfares.cz';

    await service.requestContactCode(
      {
        identifier: 'person@example.test',
        return_url: 'https://catalog.alfares.cz/orders',
        client_id: 'catalog',
        state: 'xyz',
        purpose: 'recovery',
      } as any,
      '10.0.0.1',
    );

    const result: any = await service.verifyContactCode({
      identifier: 'person@example.test',
      code: '123456',
      purpose: 'recovery',
      lang: 'cs',
    } as any);

    expect(result.recovery).toBe(true);
    expect(result.ttlMinutes).toBe(9);
    // Carry the language across the redirect, or a Czech user finishes recovery in English.
    expect(result.redirectUrl).toContain('lang=cs');
    expect(result.accessToken).toBeUndefined();
    expect(result.refreshToken).toBeUndefined();
    expect(result.redirectUrl).toContain('https://auth.alfares.cz/set-password?');
    expect(result.redirectUrl).toContain('ttl=9');

    // The completion target lives on the row, never in the URL the user can edit.
    expect(savedGrants).toHaveLength(1);
    expect(savedGrants[0].returnUrl).toBe('https://catalog.alfares.cz/orders');
    expect(savedGrants[0].clientId).toBe('catalog');
    expect(savedGrants[0].state).toBe('xyz');
    expect(result.redirectUrl).not.toContain('catalog.alfares.cz');
  });

  it('refuses to sign in with a recovery code', async () => {
    const { service } = makeService();
    await service.requestContactCode(
      {
        identifier: 'person@example.test',
        return_url: 'https://catalog.alfares.cz/orders',
        purpose: 'recovery',
      } as any,
      '10.0.0.1',
    );

    await expect(
      service.verifyContactCode({ identifier: 'person@example.test', code: '123456' } as any),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refuses to recover with a login code', async () => {
    const { service } = makeService();
    await service.requestContactCode(
      { identifier: 'person@example.test', return_url: 'https://catalog.alfares.cz/orders' } as any,
      '10.0.0.1',
    );

    await expect(
      service.verifyContactCode({
        identifier: 'person@example.test',
        code: '123456',
        purpose: 'recovery',
      } as any),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --runTestsByPath src/auth/auth-contact-code.spec.ts`
Expected: FAIL — `result.recovery` is undefined and a login verify happily accepts the recovery code

- [ ] **Step 3: Add `purpose` to the verify DTO**

In `src/auth/dto/contact-code-verify.dto.ts`, add after `code`:

```ts
  @IsOptional()
  @IsIn(['login', 'recovery'])
  purpose?: 'login' | 'recovery';

  // Without this the set-password URL is built with the default language and a Czech or
  // Russian user is dropped onto an English screen mid-recovery. The request DTO already
  // carries lang; verify is the step that builds the redirect, so it needs it too.
  @IsOptional()
  @IsIn(['en', 'cs', 'ru'])
  lang?: 'en' | 'cs' | 'ru';
```

and add `IsIn` to the existing `class-validator` import.

- [ ] **Step 4: Add the grant and URL helpers**

Add these private methods to `AuthService`, directly above `verifyContactCode`:

```ts
  private async mintPasswordRecoveryGrant(
    userId: string,
    target: { returnUrl: string | null; clientId: string | null; state: string | null },
  ): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + this.passwordRecoveryTtlMinutes * 60 * 1000);
    const grant = this.passwordResetTokenRepository.create({
      userId,
      token,
      expiresAt,
      used: false,
      returnUrl: target.returnUrl || null,
      clientId: target.clientId,
      state: target.state,
    });
    await this.passwordResetTokenRepository.save(grant);
    return token;
  }

  private buildSetPasswordUrl(token: string, lang: 'en' | 'cs' | 'ru'): string {
    const frontendUrl = process.env.FRONTEND_URL;
    if (!frontendUrl) {
      throw new BadRequestException('Frontend URL is not configured');
    }
    // return_url, client_id and state are deliberately absent: they live on the grant row so
    // the completion target cannot be rewritten by editing this URL. `ttl` is display only.
    const params = new URLSearchParams({
      token,
      lang,
      ttl: String(this.passwordRecoveryTtlMinutes),
    });
    return `${frontendUrl}/set-password?${params.toString()}`;
  }
```

- [ ] **Step 5: Branch the verify on purpose**

In `verifyContactCode` (`src/auth/auth.service.ts:1684`), add near the top beside the existing `code` extraction:

```ts
    const purpose: 'login' | 'recovery' = dto.purpose === 'recovery' ? 'recovery' : 'login';
```

Change the hash lookup to scope by purpose:

```ts
    const tokenHash = this.contactCodeHash(identifier, code, purpose);
```

Add a purpose check to the existing guard so a row is rejected when the stored purpose disagrees. Defence in depth: the hash already separates the two, and this keeps them separated if the hash ever changes. Replace the guard condition:

```ts
    if (!token || token.email !== identifier || (token.purpose || 'login') !== purpose || new Date() > token.expiresAt) {
```

After the `used` flag is set and the user has been loaded and checked, insert the recovery branch **before** the existing `finalReturnUrl` / `generateTokens` lines:

```ts
    if (purpose === 'recovery') {
      const recoveryReturnUrl = this.validateReturnUrl(dto.return_url || token.returnUrl);
      const grantToken = await this.mintPasswordRecoveryGrant(user.id, {
        returnUrl: recoveryReturnUrl,
        clientId: token.clientId || dto.client_id || null,
        state: token.state || null,
      });

      this.audit('info', 'password_recovery_verify', 'success', {
        identifier,
        contact_type: contactType,
        user_id: user.id,
        client_id: token.clientId,
        duration_ms: Date.now() - startedAt,
      });

      return {
        recovery: true as const,
        ttlMinutes: this.passwordRecoveryTtlMinutes,
        redirectUrl: this.buildSetPasswordUrl(grantToken, this.normalizeAuthLang(dto.lang)),
      };
    }
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- --runTestsByPath src/auth/auth-contact-code.spec.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
rtk git add src/auth/dto/contact-code-verify.dto.ts src/auth/auth.service.ts src/auth/auth-contact-code.spec.ts
rtk git commit -m "feat(auth): exchange a recovery code for a single-use grant"
```

---

### Task 5: Completing the grant signs the user in

**Files:**
- Modify: `src/auth/auth.service.ts` — `confirmPasswordReset` (line 762)
- Test: `src/auth/password-recovery-flow.spec.ts` (create)

**Interfaces:**
- Consumes: the grant row shape from Task 4.
- Produces: `confirmPasswordReset` returns `{ message, user, accessToken, refreshToken, redirectUrl }` when the grant carries a `returnUrl`, and the existing `{ message }` otherwise.

- [ ] **Step 1: Write the failing test**

Create `src/auth/password-recovery-flow.spec.ts`:

```ts
import { BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('password recovery flow', () => {
  const user = {
    id: 'user-1',
    email: 'person@example.test',
    isActive: true,
    userType: 'end_user',
  } as any;

  function makeService() {
    const grants: any[] = [];
    const service: any = Object.create(AuthService.prototype);
    service.usersService = {
      findById: jest.fn(async (id: string) => (id === user.id ? user : null)),
      updatePassword: jest.fn(async () => undefined),
    };
    service.rolesService = {
      getUserRoles: jest.fn(async () => ['app:catalog:user']),
      assignDefaultApplicationAccess: jest.fn(async () => ({ assigned: true })),
    };
    service.jwtService = {
      sign: jest.fn(() => 'signed-token'),
      decode: jest.fn(() => ({ exp: Math.floor(Date.now() / 1000) + 3600 })),
    };
    service.logger = { log: jest.fn(), warn: jest.fn(), error: jest.fn() };
    service.allowedRedirectOrigins = [];
    service.passwordRecoveryTtlMinutes = 15;
    service.passwordResetTokenRepository = {
      create: jest.fn((payload: any) => ({ id: 'grant-1', ...payload })),
      save: jest.fn(async (grant: any) => {
        const existing = grants.findIndex((g) => g.token === grant.token);
        if (existing >= 0) grants[existing] = grant;
        else grants.push(grant);
        return grant;
      }),
      findOne: jest.fn(async ({ where }: any) => grants.find((g) => g.token === where.token && g.used === where.used) || null),
    };
    return { service: service as AuthService, grants };
  }

  function addGrant(grants: any[], overrides: Record<string, unknown> = {}) {
    const grant = {
      id: 'grant-1',
      userId: user.id,
      token: 'grant-token',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      used: false,
      returnUrl: 'https://catalog.alfares.cz/orders',
      clientId: 'catalog',
      state: 'xyz',
      user,
      ...overrides,
    };
    grants.push(grant);
    return grant;
  }

  afterEach(() => jest.restoreAllMocks());

  it('signs the user in and sends them where they were going', async () => {
    const { service, grants } = makeService();
    addGrant(grants);

    const result: any = await service.confirmPasswordReset({
      token: 'grant-token',
      newPassword: 'a-new-password',
    } as any);

    expect(result.accessToken).toBe('signed-token');
    expect(result.refreshToken).toBe('signed-token');
    expect(result.redirectUrl).toContain('https://catalog.alfares.cz/orders#');
    expect(result.redirectUrl).toContain('access_token=signed-token');
    expect(result.redirectUrl).toContain('auth_method=password_recovery');
    expect(result.redirectUrl).toContain('state=xyz');
    expect((service as any).usersService.updatePassword).toHaveBeenCalledTimes(1);
  });

  it('leaves a grant without a return target on the old message-only shape', async () => {
    const { service, grants } = makeService();
    addGrant(grants, { returnUrl: null, clientId: null, state: null });

    const result: any = await service.confirmPasswordReset({
      token: 'grant-token',
      newPassword: 'a-new-password',
    } as any);

    expect(result).toEqual({ message: 'Password reset successfully' });
  });

  it('rejects a replayed grant', async () => {
    const { service, grants } = makeService();
    addGrant(grants);

    await service.confirmPasswordReset({ token: 'grant-token', newPassword: 'a-new-password' } as any);
    await expect(
      service.confirmPasswordReset({ token: 'grant-token', newPassword: 'another-password' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an expired grant', async () => {
    const { service, grants } = makeService();
    addGrant(grants, { expiresAt: new Date(Date.now() - 1000) });

    await expect(
      service.confirmPasswordReset({ token: 'grant-token', newPassword: 'a-new-password' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses a return target outside the allowed origins', async () => {
    const { service, grants } = makeService();
    (service as any).allowedRedirectOrigins = ['https://catalog.alfares.cz'];
    addGrant(grants, { returnUrl: 'https://evil.example/steal' });

    await expect(
      service.confirmPasswordReset({ token: 'grant-token', newPassword: 'a-new-password' } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --runTestsByPath src/auth/password-recovery-flow.spec.ts`
Expected: FAIL — `result.accessToken` is undefined; `confirmPasswordReset` returns only a message

- [ ] **Step 3: Complete the grant into a session**

In `confirmPasswordReset` (`src/auth/auth.service.ts:762`), replace the final `return { message: 'Password reset successfully' };` with:

```ts
    if (!resetToken.returnUrl) {
      return { message: 'Password reset successfully' };
    }

    // Re-validate at handoff, not only at mint: the allowlist may have changed since, and a
    // grant row is long-lived relative to a config reload.
    const finalReturnUrl = this.validateReturnUrl(resetToken.returnUrl);
    const tokens = await this.generateTokens(
      resetToken.userId,
      'password_recovery',
      resetToken.clientId,
      finalReturnUrl,
    );
    const user = await this.usersService.findById(resetToken.userId);

    return {
      message: 'Password reset successfully',
      user: this.sanitizeUser(user),
      ...tokens,
      redirectUrl: this.buildTokenHandoffUrl(
        finalReturnUrl,
        tokens,
        'password_recovery',
        resetToken.state || undefined,
      ),
    };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- --runTestsByPath src/auth/password-recovery-flow.spec.ts`
Expected: PASS, 5 tests

- [ ] **Step 5: Commit**

```bash
rtk git add src/auth/auth.service.ts src/auth/password-recovery-flow.spec.ts
rtk git commit -m "feat(auth): completing a recovery grant signs the user in"
```

---

### Task 6: The email-link path joins the same flow

**Files:**
- Modify: `src/auth/auth.service.ts` — `requestPasswordReset` (line 657)
- Test: `src/auth/password-recovery-flow.spec.ts`

**Interfaces:**
- Consumes: `mintPasswordRecoveryGrant` (Task 4), `resolvePasswordRecoveryTtlMinutes` (Task 1).
- Produces: nothing new.

- [ ] **Step 1: Write the failing test**

Append to `src/auth/password-recovery-flow.spec.ts`, inside the top-level `describe`:

```ts
  it('stores the return target on the link grant and states one TTL everywhere', async () => {
    const { service, grants } = makeService();
    (service as any).passwordRecoveryTtlMinutes = 11;
    (service as any).usersService.findByEmail = jest.fn(async () => user);
    (service as any).notificationsServiceUrl = 'http://notifications';
    (service as any).notificationServiceToken = 'service-token';
    const sent: any[] = [];
    (service as any).httpService = {
      post: jest.fn((_url: string, payload: any) => {
        sent.push(payload);
        return { subscribe: (o: any) => o.next({ data: {} }) } as any;
      }),
    };
    process.env.FRONTEND_URL = 'https://auth.alfares.cz';

    const before = Date.now();
    await service.requestPasswordReset({
      email: 'person@example.test',
      return_url: 'https://catalog.alfares.cz/orders',
      client_id: 'catalog',
      state: 'xyz',
      lang: 'en',
    } as any);

    expect(grants).toHaveLength(1);
    expect(grants[0].returnUrl).toBe('https://catalog.alfares.cz/orders');
    expect(grants[0].clientId).toBe('catalog');
    expect(grants[0].state).toBe('xyz');

    // The stored expiry and the number printed in the email must be the same value.
    const ttlMs = new Date(grants[0].expiresAt).getTime() - before;
    expect(ttlMs).toBeGreaterThan(10 * 60 * 1000);
    expect(ttlMs).toBeLessThanOrEqual(11 * 60 * 1000 + 1000);
    expect(sent[0].message).toContain('11 minutes');
    expect(sent[0].message).not.toContain('60 minutes');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --runTestsByPath src/auth/password-recovery-flow.spec.ts -t 'link grant'`
Expected: FAIL — the email says `60 minutes` and the grant has no `returnUrl`

- [ ] **Step 3: Use the shared TTL and persist the target**

In `requestPasswordReset` (`src/auth/auth.service.ts:657`), replace the token-creation block (currently the `crypto.randomBytes` line through the `passwordResetTokenRepository.save` call) with a call to the shared helper, so both entry points mint grants identically:

```ts
    let validatedReturnUrl: string | null = null;
    if (passwordResetRequestDto.return_url) {
      try {
        validatedReturnUrl = this.validateReturnUrl(passwordResetRequestDto.return_url);
      } catch {
        // Ignore an invalid return_url - don't fail the reset request over it.
      }
    }

    const token = await this.mintPasswordRecoveryGrant(user.id, {
      returnUrl: validatedReturnUrl,
      clientId: passwordResetRequestDto.client_id || null,
      state: passwordResetRequestDto.state || null,
    });
```

Then replace the hardcoded `const resetTtlMinutes = 60;` (line 713) with:

```ts
    const resetTtlMinutes = this.passwordRecoveryTtlMinutes;
```

and reuse `validatedReturnUrl` for the querystring rather than re-validating:

```ts
    if (validatedReturnUrl) {
      resetUrlParams.set('return_url', validatedReturnUrl);
    }
```

Add `ttl` to the reset URL so the page can state the window:

```ts
    resetUrlParams.set('ttl', String(this.passwordRecoveryTtlMinutes));
```

- [ ] **Step 4: Confirm the 1-hour expiry is really gone**

Run: `rtk rg -n 'setHours|resetTtlMinutes = 60|60 \* 60 \* 1000' src/auth/auth.service.ts`
Expected: no match for any of them in the password-reset path. A leftover `setHours(+1)` would keep the row alive for an hour while the email promises 15 minutes.

- [ ] **Step 5: Run the tests**

Run: `npm test -- --runTestsByPath src/auth/password-recovery-flow.spec.ts`
Expected: PASS, 6 tests

- [ ] **Step 6: Commit**

```bash
rtk git add src/auth/auth.service.ts src/auth/password-recovery-flow.spec.ts
rtk git commit -m "feat(auth): reset links share the recovery grant and TTL"
```

---

### Task 7: The hosted login page

**Files:**
- Modify: `web/server.js:172`
- Modify: `web/public/index.html`
- Test: `src/auth/hosted-auth-web.spec.ts`

**Interfaces:**
- Consumes: `ttlMinutes` from `/auth/contact-code/request`, `recovery` + `redirectUrl` from `/auth/contact-code/verify`, `redirectUrl` from `/auth/password-reset-confirm`, and `ttl` from the page querystring.
- Produces: nothing consumed by later tasks.

**Note:** the existing `reset` mode already renders exactly the set-password screen — identifier hidden, password + confirm shown, `new-password` autocomplete. `/set-password` is therefore an alias path onto that mode, not a new mode.

- [ ] **Step 1: Write the failing tests**

Append to `src/auth/hosted-auth-web.spec.ts` a new `describe` block inside the top-level one:

```ts
  describe('password recovery', () => {
    it('serves the set-password path', () => {
      expect(webServer).toContain("'/set-password'");
    });

    it('treats /set-password as the reset screen', () => {
      expect(html).toContain("window.location.pathname === '/set-password'");
    });

    it('recovers with a code rather than a link', () => {
      const fn = html.slice(html.indexOf('async function requestPasswordReset'), html.indexOf('async function requestPasswordReset') + 900);
      expect(fn).toContain("purpose: 'recovery'");
      expect(fn).toContain('/auth/contact-code/request');
    });

    it('follows the server to the set-password screen', () => {
      expect(html).toContain('if (data.recovery)');
    });

    it('completes into the application after the password is set', () => {
      const fn = html.slice(html.indexOf('/auth/password-reset-confirm'), html.indexOf('/auth/password-reset-confirm') + 900);
      expect(fn).toContain('data.redirectUrl');
    });

    // The lifetime the page shows must come from the backend. A literal here can drift from
    // the stored expiry and quietly start lying to people.
    it('never hardcodes a lifetime', () => {
      expect(html).toContain('{minutes}');
      const i18nBlock = html.slice(html.indexOf('const I18N'), html.indexOf('function t('));
      expect(i18nBlock).not.toMatch(/\b15 (minutes|minut|мин)/);
    });

    it('interpolates parameters into translations', () => {
      expect(html).toContain('function t(key, params)');
    });

    it('offers the recovery copy in all three languages', () => {
      const count = (html.match(/recoveryCodeSent:/g) || []).length;
      expect(count).toBe(3);
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- --runTestsByPath src/auth/hosted-auth-web.spec.ts`
Expected: FAIL on all eight new assertions

- [ ] **Step 3: Serve the new path**

In `web/server.js:172`:

```js
app.get(['/login', '/register', '/reset-password', '/set-password'], (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
```

- [ ] **Step 4: Map the path onto the reset screen**

In `web/public/index.html`, replace the `initialMode` line (line 358):

```js
    const resetPaths = ['/reset-password', '/set-password'];
    const initialMode = window.location.pathname === '/register'
      ? 'register'
      : (resetPaths.includes(window.location.pathname) ? 'reset' : 'login');
```

Add beside the other querystring reads (near line 361):

```js
    const ttlFromUrl = params.get('ttl') || '';
    let recoveryTtlMinutes = ttlFromUrl;
```

- [ ] **Step 5: Let translations take parameters**

Replace `t` (line 303):

```js
    function t(key, params) {
      const dict = I18N[currentLang] || I18N.en;
      let out = dict[key] || I18N.en[key] || key;
      if (params) {
        Object.keys(params).forEach(function (name) {
          out = out.split('{' + name + '}').join(params[name]);
        });
      }
      return out;
    }
```

- [ ] **Step 6: Add the copy**

Add these keys to each of the three `I18N` language blocks, beside the existing `codeSent`:

```js
        // en
        recoveryCodeSent: 'Recovery code sent. Enter the 6-digit code here. It expires in {minutes} min.',
        setPasswordWindow: 'Choose a new password within {minutes} min.',
        passwordUpdatedRedirecting: 'Password updated. Taking you back…',
```

```js
        // cs
        recoveryCodeSent: 'Kód pro obnovení byl odeslán. Zadejte 6místný kód. Platí {minutes} min.',
        setPasswordWindow: 'Zvolte si nové heslo do {minutes} min.',
        passwordUpdatedRedirecting: 'Heslo bylo změněno. Přesměrováváme vás zpět…',
```

```js
        // ru
        recoveryCodeSent: 'Код для восстановления отправлен. Введите 6-значный код. Он действует {minutes} мин.',
        setPasswordWindow: 'Задайте новый пароль в течение {minutes} мин.',
        passwordUpdatedRedirecting: 'Пароль изменён. Возвращаем вас назад…',
```

- [ ] **Step 7: Point "Forgot password?" at the recovery code**

Replace the body of `requestPasswordReset` (the `fetch` at line 672 onward is a different function — this is the one starting near line 790) so it requests a recovery code instead of an email link:

```js
    async function requestPasswordReset() {
      setError('');
      setSuccess('');
      const identifier = identifierInput.value.trim();
      if (!validatedReturnUrl) {
        setError(t('invalidReturnUrl'));
        return;
      }
      if (!identifier) {
        setError(t('enterEmailOrPhone'));
        return;
      }
      resetPasswordBtn.disabled = true;
      try {
        const response = await fetch('/auth/contact-code/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            identifier,
            return_url: validatedReturnUrl,
            client_id: clientId || undefined,
            state: state || undefined,
            app_domain: window.location.hostname,
            lang: currentLang,
            purpose: 'recovery',
          }),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({ message: t('codeRequestFailed') }));
          throw new Error(body.message || t('codeRequestFailed'));
        }
        const data = await response.json();
        recoveryTtlMinutes = data.ttlMinutes;
        contactCodeRequestedFor = identifier;
        recoveryRequested = true;
        contactCodeInput.value = '';
        contactCodeRow.style.display = 'block';
        contactCodeInput.focus();
        setSuccess(t('recoveryCodeSent', { minutes: data.ttlMinutes }));
      } catch (error) {
        setError(error.message || t('codeFlowFailed'));
      } finally {
        resetPasswordBtn.disabled = false;
      }
    }
```

Declare the flag beside `contactCodeRequestedFor` (line 397):

```js
    let recoveryRequested = false;
```

- [ ] **Step 8: Send the purpose when verifying, and follow the server**

In `verifyContactCode`, add `purpose` to the request body:

```js
            purpose: recoveryRequested ? 'recovery' : undefined,
            lang: currentLang,
```

and replace the success handling:

```js
        const data = await verifyResponse.json();
        if (data.recovery) {
          window.location.assign(data.redirectUrl);
          return;
        }
        window.location.assign(data.redirectUrl || buildTokenHandoffUrl(validatedReturnUrl, data, state));
```

- [ ] **Step 9: Complete the set-password screen into the application**

In the reset submit handler, replace the success block (lines 681-686) with:

```js
        const data = await response.json().catch(() => ({}));
        passwordInput.value = '';
        passwordConfirmInput.value = '';
        if (data.redirectUrl) {
          setSuccess(t('passwordUpdatedRedirecting'));
          window.location.assign(data.redirectUrl);
          return;
        }
        passwordRow.style.display = 'none';
        passwordConfirmRow.style.display = 'none';
        submitBtn.style.display = 'none';
        setSuccess(t('resetSuccess'));
```

- [ ] **Step 10: State the window on the set-password screen**

In `syncMode`, inside the branch that runs when `isReset`, set the subtitle from the TTL when the URL carried one:

```js
      authSubtitle.textContent = isReset
        ? (recoveryTtlMinutes ? t('setPasswordWindow', { minutes: recoveryTtlMinutes }) : t('subtitleReset'))
        : (isRegister
          ? (marathonPhoneRequired ? t('subtitleRegisterMarathon') : t('subtitleRegister'))
          : t('subtitleLogin'));
```

- [ ] **Step 11: Run tests to verify they pass**

Run: `npm test -- --runTestsByPath src/auth/hosted-auth-web.spec.ts`
Expected: PASS

- [ ] **Step 12: Commit**

```bash
rtk git add web/server.js web/public/index.html src/auth/hosted-auth-web.spec.ts
rtk git commit -m "feat(auth): recover with a code and finish on the target page"
```

---

### Task 8: Whole-flow verification

**Files:** none modified — this task proves the previous seven.

- [ ] **Step 1: Typecheck by path**

Run: `./node_modules/.bin/tsc --noEmit -p tsconfig.json`
Expected: no output. Do not substitute `npx tsc`; it runs an unrelated package that prints a friendly message and reads as a pass.

- [ ] **Step 2: Full suite**

Run: `npm test`
Expected: all suites pass, including `auth-contract.spec.ts`, which asserts response shapes that Task 5 changed

- [ ] **Step 3: Prove the TTL test can fail**

A green check that never ran is worse than a red one. Temporarily change `resetTtlMinutes` in `requestPasswordReset` back to a literal `60`:

Run: `npm test -- --runTestsByPath src/auth/password-recovery-flow.spec.ts`
Expected: FAIL on `expect(sent[0].message).toContain('11 minutes')`

Revert the literal and re-run. Expected: PASS. If the test passed with the literal in place, it is asserting nothing and must be fixed before proceeding.

- [ ] **Step 4: Confirm no lifetime literal survives anywhere**

Run: `rtk rg -n '\b(15|60) (minutes|minut|мин)' src/ web/public/index.html`
Expected: no matches. Every displayed lifetime interpolates.

- [ ] **Step 5: Confirm no consumer was touched**

Run: `rtk git diff --stat main -- . ':!docs'`
Expected: changes confined to `src/auth/`, `web/`, `.env.example`, `deploy.config.sh`. Any other path means the blast radius exceeded the design.

- [ ] **Step 6: Commit any fixes**

```bash
rtk git add -A
rtk git commit -m "test(auth): verify recovery TTL wiring end to end"
```

---

## Deploy boundary

Implementation stops here. Deploying requires, in order:

1. Apply `docs/sql/2026-07-23-password-recovery-columns.sql` to the production `auth` database. It is additive and backward-compatible, so it can be applied before the new build ships.
2. Set `AUTH_PASSWORD_RECOVERY_TTL_MINUTES` in the environment and confirm it reaches the pod — a value absent from `deploy.config.sh`'s `configmap_vars` silently falls back to 15.
3. Run `./scripts/deploy.sh`, which takes the ecosystem-wide deploy lock. Deploys are serialized; do not run this in parallel with any other build or rollout.
4. Reproduce the original failure: from `catalog.alfares.cz`, follow "Forgot password?" through code entry and password entry, and confirm the browser lands back on the catalog page authenticated, and that the new password works on a subsequent normal login.

Record the deferred deploy in `TASKS.md` so it is not mistaken for unfinished implementation.
