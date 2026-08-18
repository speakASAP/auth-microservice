/**
 * JWT Strategy for Passport
 */

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from './auth.service';
import { requireJwtSecret, getJwtPublicKey, getJwtKeyId } from './jwt-secret';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // TASK-KEY-F3 step 3: passport resolves the key per token, so both algorithms work
      // during the migration. `secretOrKeyProvider` is the only hook that sees the header;
      // a fixed `secretOrKey` could not tell RS256 and HS256 tokens apart.
      secretOrKeyProvider: (_req: unknown, rawJwt: string, done: (err: Error | null, key?: string) => void) => {
        try {
          const header = JSON.parse(
            Buffer.from(String(rawJwt).split('.')[0], 'base64url').toString('utf8'),
          ) as { alg?: string; kid?: string };

          if (header.alg === 'RS256') {
            const pem = getJwtPublicKey();
            const kid = getJwtKeyId();
            if (!pem || !kid) {
              return done(new Error('RS256 token received but no public key is configured'));
            }
            if (header.kid && header.kid !== kid) {
              return done(new Error(`RS256 token kid ${header.kid} does not match ${kid}`));
            }
            return done(null, pem);
          }

          return done(null, requireJwtSecret());
        } catch (err) {
          return done(err instanceof Error ? err : new Error('Malformed JWT header'));
        }
      },
      algorithms: ['RS256', 'HS256'],
    });
  }

  async validate(payload: any) {
    const user = await this.authService.validateUser(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}

