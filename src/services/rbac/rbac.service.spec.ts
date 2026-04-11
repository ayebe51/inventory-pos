import { Test, TestingModule } from '@nestjs/testing';
import * as fc from 'fast-check';
import { RbacService, PERMISSION_MODULES, PERMISSION_ACTIONS, SPECIAL_PERMISSIONS } from './rbac.service';
import { PrismaService } from '../../config/prisma.service';
import { CacheService } from '../cache/cache.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildUserRoles(permissions: Array<{ module: string; action: string }>) {
  return [
    {
      role: {
        role_permissions: permissions.map((p, i) => ({
          permission: { id: `perm-${i}`, module: p.module, action: p.action },
        })),
      },
    },
  ];
}

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPrisma = {
  userRole: {
    findMany: jest.fn(),
  },
};

const mockCacheService = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

// ── Test Suite ────────────────────────────────────────────────────────────────

describe('RbacService', () => {
  let service: RbacService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RbacService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CacheService, useValue: mockCacheService },
      ],
    }).compile();

    service = module.get<RbacService>(RbacService);
  });

  // ── isValidPermission ────────────────────────────────────────────────────────

  describe('isValidPermission', () => {
    it('accepts valid MODULE.ACTION permissions', () => {
      expect(service.isValidPermission('PURCHASE.READ')).toBe(true);
      expect(service.isValidPermission('INVENTORY.CREATE')).toBe(true);
      expect(service.isValidPermission('ACCOUNTING.APPROVE')).toBe(true);
      expect(service.isValidPermission('REPORT.EXPORT')).toBe(true);
      expect(service.isValidPermission('ADMIN.DELETE')).toBe(true);
    });

    it('accepts all special permissions', () => {
      for (const perm of SPECIAL_PERMISSIONS) {
        expect(service.isValidPermission(perm)).toBe(true);
      }
    });

    it('rejects unknown module', () => {
      expect(service.isValidPermission('UNKNOWN.READ')).toBe(false);
    });

    it('rejects unknown action', () => {
      expect(service.isValidPermission('PURCHASE.UNKNOWN')).toBe(false);
    });

    it('rejects malformed strings', () => {
      expect(service.isValidPermission('')).toBe(false);
      expect(service.isValidPermission('PURCHASE')).toBe(false);
      expect(service.isValidPermission('PURCHASE.READ.EXTRA')).toBe(false);
      expect(service.isValidPermission('.')).toBe(false);
    });

    it('rejects null/undefined-like values', () => {
      expect(service.isValidPermission(null as unknown as string)).toBe(false);
      expect(service.isValidPermission(undefined as unknown as string)).toBe(false);
    });
  });

  // ── getUserPermissions ───────────────────────────────────────────────────────

  describe('getUserPermissions', () => {
    it('returns permissions from DB and caches them', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockPrisma.userRole.findMany.mockResolvedValue(
        buildUserRoles([
          { module: 'PURCHASE', action: 'READ' },
          { module: 'PURCHASE', action: 'APPROVE' },
        ]),
      );
      mockCacheService.set.mockResolvedValue(undefined);

      const result = await service.getUserPermissions('user-1');

      expect(result).toContain('PURCHASE.READ');
      expect(result).toContain('PURCHASE.APPROVE');
      expect(mockCacheService.set).toHaveBeenCalledWith(
        'rbac:permissions:user-1',
        expect.arrayContaining(['PURCHASE.READ', 'PURCHASE.APPROVE']),
        300,
      );
    });

    it('returns cached permissions without hitting DB', async () => {
      mockCacheService.get.mockResolvedValue(['INVENTORY.READ', 'STOCK.ADJUST']);

      const result = await service.getUserPermissions('user-1');

      expect(result).toEqual(['INVENTORY.READ', 'STOCK.ADJUST']);
      expect(mockPrisma.userRole.findMany).not.toHaveBeenCalled();
    });

    it('deduplicates permissions from multiple roles', async () => {
      mockCacheService.get.mockResolvedValue(null);
      // Two roles both granting PURCHASE.READ
      mockPrisma.userRole.findMany.mockResolvedValue([
        {
          role: {
            role_permissions: [
              { permission: { id: 'p1', module: 'PURCHASE', action: 'READ' } },
            ],
          },
        },
        {
          role: {
            role_permissions: [
              { permission: { id: 'p2', module: 'PURCHASE', action: 'READ' } },
              { permission: { id: 'p3', module: 'INVENTORY', action: 'READ' } },
            ],
          },
        },
      ]);
      mockCacheService.set.mockResolvedValue(undefined);

      const result = await service.getUserPermissions('user-1');

      const purchaseReadCount = result.filter((p) => p === 'PURCHASE.READ').length;
      expect(purchaseReadCount).toBe(1);
      expect(result).toContain('INVENTORY.READ');
    });

    it('returns empty array when user has no roles', async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockPrisma.userRole.findMany.mockResolvedValue([]);
      mockCacheService.set.mockResolvedValue(undefined);

      const result = await service.getUserPermissions('user-no-roles');

      expect(result).toEqual([]);
    });
  });

  // ── checkPermission ──────────────────────────────────────────────────────────

  describe('checkPermission', () => {
    it('returns true when user has the permission', async () => {
      mockCacheService.get.mockResolvedValue(['PURCHASE.APPROVE', 'INVENTORY.READ']);

      const result = await service.checkPermission('user-1', 'PURCHASE.APPROVE');

      expect(result).toBe(true);
    });

    it('returns false when user does not have the permission', async () => {
      mockCacheService.get.mockResolvedValue(['INVENTORY.READ']);

      const result = await service.checkPermission('user-1', 'PURCHASE.APPROVE');

      expect(result).toBe(false);
    });

    it('returns false for invalid permission format', async () => {
      const result = await service.checkPermission('user-1', 'INVALID.FORMAT');

      expect(result).toBe(false);
      expect(mockCacheService.get).not.toHaveBeenCalled();
    });

    it('returns true for special permission when user has it', async () => {
      mockCacheService.get.mockResolvedValue(['PRICE.OVERRIDE', 'POS.VOID']);

      const result = await service.checkPermission('user-1', 'PRICE.OVERRIDE');

      expect(result).toBe(true);
    });

    it('returns false for special permission when user lacks it', async () => {
      mockCacheService.get.mockResolvedValue(['INVENTORY.READ']);

      const result = await service.checkPermission('user-1', 'PERIOD.CLOSE');

      expect(result).toBe(false);
    });
  });

  // ── hasAnyPermission ─────────────────────────────────────────────────────────

  describe('hasAnyPermission', () => {
    it('returns true when user has at least one of the permissions', async () => {
      mockCacheService.get.mockResolvedValue(['INVENTORY.READ']);

      const result = await service.hasAnyPermission('user-1', [
        'PURCHASE.APPROVE',
        'INVENTORY.READ',
      ]);

      expect(result).toBe(true);
    });

    it('returns false when user has none of the permissions', async () => {
      mockCacheService.get.mockResolvedValue(['INVENTORY.READ']);

      const result = await service.hasAnyPermission('user-1', [
        'PURCHASE.APPROVE',
        'PERIOD.CLOSE',
      ]);

      expect(result).toBe(false);
    });

    it('returns false for empty permissions array', async () => {
      const result = await service.hasAnyPermission('user-1', []);

      expect(result).toBe(false);
      expect(mockCacheService.get).not.toHaveBeenCalled();
    });
  });

  // ── hasAllPermissions ────────────────────────────────────────────────────────

  describe('hasAllPermissions', () => {
    it('returns true when user has all permissions', async () => {
      mockCacheService.get.mockResolvedValue(['PURCHASE.READ', 'PURCHASE.APPROVE', 'INVENTORY.READ']);

      const result = await service.hasAllPermissions('user-1', [
        'PURCHASE.READ',
        'PURCHASE.APPROVE',
      ]);

      expect(result).toBe(true);
    });

    it('returns false when user is missing one permission', async () => {
      mockCacheService.get.mockResolvedValue(['PURCHASE.READ']);

      const result = await service.hasAllPermissions('user-1', [
        'PURCHASE.READ',
        'PURCHASE.APPROVE',
      ]);

      expect(result).toBe(false);
    });

    it('returns true for empty permissions array', async () => {
      const result = await service.hasAllPermissions('user-1', []);

      expect(result).toBe(true);
      expect(mockCacheService.get).not.toHaveBeenCalled();
    });
  });

  // ── invalidateUserPermissionsCache ───────────────────────────────────────────

  describe('invalidateUserPermissionsCache', () => {
    it('deletes the cache key for the user', async () => {
      mockCacheService.del.mockResolvedValue(undefined);

      await service.invalidateUserPermissionsCache('user-1');

      expect(mockCacheService.del).toHaveBeenCalledWith('rbac:permissions:user-1');
    });
  });

  // ── Property-Based Tests ─────────────────────────────────────────────────────

  describe('isValidPermission - property tests', () => {
    /**
     * Validates: Requirements 3.4
     * Property: Every MODULE.ACTION combination from known modules and actions is valid.
     */
    it('accepts all valid MODULE.ACTION combinations', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...PERMISSION_MODULES),
          fc.constantFrom(...PERMISSION_ACTIONS),
          (module, action) => {
            return service.isValidPermission(`${module}.${action}`) === true;
          },
        ),
      );
    });

    /**
     * Validates: Requirements 3.4
     * Property: All special permissions are valid.
     */
    it('accepts all special permissions', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...Array.from(SPECIAL_PERMISSIONS)),
          (perm) => {
            return service.isValidPermission(perm) === true;
          },
        ),
      );
    });

    /**
     * Validates: Requirements 3.4
     * Property: Random strings that are not valid permissions are rejected.
     */
    it('rejects arbitrary strings that are not valid permissions', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 30 }).filter((s) => {
            // Exclude strings that happen to be valid
            if (SPECIAL_PERMISSIONS.has(s)) return false;
            const parts = s.split('.');
            if (parts.length !== 2) return true;
            const [mod, act] = parts;
            return !(
              (PERMISSION_MODULES as readonly string[]).includes(mod) &&
              (PERMISSION_ACTIONS as readonly string[]).includes(act)
            );
          }),
          (invalidPerm) => {
            return service.isValidPermission(invalidPerm) === false;
          },
        ),
      );
    });
  });

  describe('checkPermission - property tests', () => {
    /**
     * Validates: Requirements 3.4
     * Property: checkPermission returns true iff the permission is in the user's permission list.
     */
    it('is consistent with getUserPermissions result', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.tuple(
              fc.constantFrom(...PERMISSION_MODULES),
              fc.constantFrom(...PERMISSION_ACTIONS),
            ),
            { minLength: 0, maxLength: 10 },
          ),
          fc.constantFrom(...PERMISSION_MODULES),
          fc.constantFrom(...PERMISSION_ACTIONS),
          async (grantedPairs, checkModule, checkAction) => {
            jest.clearAllMocks();

            const grantedPerms = grantedPairs.map(([m, a]) => `${m}.${a}`);
            const uniqueGranted = Array.from(new Set(grantedPerms));
            mockCacheService.get.mockResolvedValue(uniqueGranted);

            const permission = `${checkModule}.${checkAction}`;
            const hasIt = await service.checkPermission('user-pbt', permission);
            const expected = uniqueGranted.includes(permission);

            return hasIt === expected;
          },
        ),
      );
    });
  });
});
