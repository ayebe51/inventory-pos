import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Decorator to declare required permissions on a route handler.
 * Usage: @RequirePermissions('PURCHASE.CREATE', 'INVENTORY.READ')
 *
 * The RbacGuard will enforce that the authenticated user holds ALL listed permissions.
 */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
