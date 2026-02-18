/**
 * Roles Decorator
 * Used to specify required roles for endpoints
 */

import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

export interface RolesOptions {
  requireAll?: boolean; // If true, user must have ALL roles (AND logic), otherwise ANY role (OR logic)
}

export const Roles = (
  ...roles: (string | RolesOptions)[]
): ReturnType<typeof SetMetadata> => {
  // Check if last argument is options object
  const lastArg = roles[roles.length - 1];
  const options: RolesOptions =
    typeof lastArg === 'object' && !Array.isArray(lastArg) && 'requireAll' in lastArg
      ? (lastArg as RolesOptions)
      : { requireAll: false };

  // Filter out options object from roles array
  const roleStrings = roles.filter(
    (r) => typeof r === 'string',
  ) as string[];

  return SetMetadata(ROLES_KEY, { roles: roleStrings, ...options });
};
