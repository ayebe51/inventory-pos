import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { CacheService } from '../cache/cache.service';
import { UUID } from '../../common/types/uuid.type';

// ── Permission constants ──────────────────────────────────────────────────────

export const PERMISSION_MODULES = [
  'PURCHASE', 'INVENTORY', 'SALES', 'POS', 'INVOICE',
  'PAYMENT', 'ACCOUNTING', 'REPORT', 'ADMIN',
] as const;

export const PERMISSION_ACTIONS = [
  'READ', 'CREATE', 'UPDATE', 'DELETE', 'APPROVE',
  'VOID', 'POST', 'LOCK', 'EXPORT', 'IMPORT',
] as const;

/** Special permissions that don't follow the standard MODULE.ACTION pattern */
export const SPECIAL_PERMISSIONS = new Set([
  'PRICE.OVERRIDE',
  'DISCOUNT.OVERRIDE',
  'STOCK.ADJUST',
  'STOCK.OPNAME',
  'PERIOD.CLOSE',
  'JOURNAL.REVERSE',
  'REPORT.FINANCIAL',
  'REPORT.EXECUTIVE',
  'ADMIN.SETTINGS',
  'ADMIN.USER',
  'INVOICE.WRITE_OFF',
]);

const CACHE_TTL_SECONDS = 5 * 60; // 5 minutes
const CACHE_KEY_PREFIX = 'rbac:permissions:';

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class RbacService {
  private readonly logger = new Logger(RbacService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Validate that a permission string matches the expected format.
   * Valid formats:
   *   - MODULE.ACTION  (e.g. PURCHASE.APPROVE, INVENTORY.READ)
   *   - Special permissions (e.g. PRICE.OVERRIDE, STOCK.ADJUST)
   */
  isValidPermission(permission: string): boolean {
    if (!permission || typeof permission !== 'string') return false;

    // Special permissions are always valid
    if (SPECIAL_PERMISSIONS.has(permission)) return true;

    const parts = permission.split('.');
    if (parts.length !== 2) return false;

    const [module, action] = parts;
    return (
      (PERMISSION_MODULES as readonly string[]).includes(module) &&
      (PERMISSION_ACTIONS as readonly string[]).includes(action)
    );
  }

  /**
   * Get all permissions for a user, using Redis cache (TTL 5 min).
   */
  async getUserPermissions(userId: UUID): Promise<string[]> {
    const cacheKey = `${CACHE_KEY_PREFIX}${userId}`;

    // Try cache first
    const cached = await this.cacheService.get<string[]>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    // Load from DB: user → roles → permissions
    const userRoles = await this.prisma.userRole.findMany({
      where: { user_id: userId },
      include: {
        role: {
          include: {
            role_permissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    const permissionSet = new Set<string>();
    for (const userRole of userRoles) {
      for (const rp of userRole.role.role_permissions) {
        const perm = `${rp.permission.module}.${rp.permission.action}`;
        permissionSet.add(perm);
      }
    }

    const permissions = Array.from(permissionSet);

    // Cache the result
    await this.cacheService.set(cacheKey, permissions, CACHE_TTL_SECONDS);

    return permissions;
  }

  /**
   * Check if a user has a specific permission.
   * Returns true if ANY of the user's roles grants the permission.
   */
  async checkPermission(userId: UUID, permission: string): Promise<boolean> {
    if (!this.isValidPermission(permission)) {
      this.logger.warn(`Invalid permission format: "${permission}"`);
      return false;
    }

    const permissions = await this.getUserPermissions(userId);
    return permissions.includes(permission);
  }

  /**
   * Check if a user has at least one of the given permissions.
   */
  async hasAnyPermission(userId: UUID, permissions: string[]): Promise<boolean> {
    if (!permissions.length) return false;

    const userPermissions = await this.getUserPermissions(userId);
    const userPermSet = new Set(userPermissions);

    return permissions.some((p) => userPermSet.has(p));
  }

  /**
   * Check if a user has ALL of the given permissions.
   */
  async hasAllPermissions(userId: UUID, permissions: string[]): Promise<boolean> {
    if (!permissions.length) return true;

    const userPermissions = await this.getUserPermissions(userId);
    const userPermSet = new Set(userPermissions);

    return permissions.every((p) => userPermSet.has(p));
  }

  /**
   * Invalidate the cached permissions for a user.
   * Call this whenever a user's roles are changed.
   */
  async invalidateUserPermissionsCache(userId: UUID): Promise<void> {
    const cacheKey = `${CACHE_KEY_PREFIX}${userId}`;
    await this.cacheService.del(cacheKey);
    this.logger.log(`Invalidated permissions cache for user ${userId}`);
  }
}
