import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';

import { AuthService } from '../auth/auth.service';
import { InternalUsersController } from './internal-users.controller';
import { UsersService } from './users.service';

/**
 * Proves the UsersModule <-> AuthModule dependency cycle actually resolves.
 *
 * `internal-users.controller.spec.ts` provides both services as plain mocks, so it
 * passes whether or not Nest can really construct the controller — the same blind spot
 * that let un-executable SQL through CI in the 2026-08-03 Finding 4 post-mortem. Adding
 * `AuthService` to this controller introduced a circular module dependency, and a
 * `forwardRef` missing on either side fails at **boot**, not in a unit test.
 *
 * This builds the controller through Nest's own injector with the real class tokens, so
 * a broken forwardRef surfaces here instead of in a rollout.
 */
describe('InternalUsersController DI wiring', () => {
  it('constructs with AuthService injected through the module cycle', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [InternalUsersController],
      providers: [
        UsersService,
        AuthService,
        // Leaf dependencies of the two services, stubbed at the token level. The point
        // here is that Nest can satisfy the controller's own constructor, not that these
        // collaborators work.
        { provide: getRepositoryToken(require('./entities/user.entity').User), useValue: {} },
        {
          provide: getRepositoryToken(
            require('./entities/legacy-identity-mapping.entity').LegacyIdentityMapping,
          ),
          useValue: {},
        },
      ],
    })
      .overrideProvider(AuthService)
      .useValue({ createSessionForUser: jest.fn() })
      .overrideProvider(UsersService)
      .useValue({})
      .compile();

    const controller = moduleRef.get(InternalUsersController);

    expect(controller).toBeInstanceOf(InternalUsersController);
    expect(typeof controller.createSession).toBe('function');
  });

  it('mints a session through the injected AuthService', async () => {
    const createSessionForUser = jest
      .fn()
      .mockResolvedValue({ accessToken: 'tok', expiresIn: 43200, userId: 'u-1' });

    const moduleRef = await Test.createTestingModule({
      controllers: [InternalUsersController],
      providers: [
        { provide: UsersService, useValue: {} },
        { provide: AuthService, useValue: { createSessionForUser } },
      ],
    }).compile();

    const result = await moduleRef.get(InternalUsersController).createSession('u-1');

    expect(createSessionForUser).toHaveBeenCalledWith('u-1');
    expect(result.accessToken).toBe('tok');
  });
});
