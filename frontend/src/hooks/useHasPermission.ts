import { useAuthStore } from '../store/authStore';

/**
 * Hook to check if the authenticated user has a specific permission or role.
 * Global admin or owner roles automatically pass all permission checks.
 */
export function useHasPermission(permissionRequired?: string): boolean {
  const user = useAuthStore((state) => state.user);

  if (!user) return false;
  if (!permissionRequired) return true;

  // Global Admin or Owner role check
  const userRoles = Array.isArray((user as any).roles) ? (user as any).roles : [user.role].filter(Boolean);
  const isGlobalAdmin = userRoles.some(
    (role: string) =>
      role.toUpperCase() === 'OWNER' ||
      role.toUpperCase() === 'ADMIN' ||
      role.toUpperCase() === 'SYS_ADMIN' ||
      role.toUpperCase() === 'SUPER_ADMIN',
  );

  if (isGlobalAdmin) return true;

  // Check specific permissions array on user
  const permissions = (user as any).permissions || [];
  return permissions.includes(permissionRequired);
}
