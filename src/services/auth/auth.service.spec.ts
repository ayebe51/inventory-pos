import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { PrismaService } from '../../config/prisma.service';
import { CacheService } from '../cache/cache.service';
import { AuditService } from '../audit/audit.service';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

function buildUser(overrides: Partial<{
  is_active: boolean;
  password_hash: string;
}> = {}) {
  return {
    id: 'user-uuid-1',
    email: 'test@example.com',
    full_name: 'Test User',
    password_hash: overrides.password_hash ?? '$2b$12$placeholder',
    is_active: overrides.is_active ?? true,
    branch_id: null,
    deleted_at: null,
    user_roles: [
      { role: { name: 'Finance_Staff' } },
    ],
  };
}

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPrisma = {
  user: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn(),
  verify: jest.fn(),
};

const mockConfigService = {
  get: jest.fn((key: string) => {
    const map: Record<string, string> = {
      'app.jwt.accessSecret': 'access-secret',
      'app.jwt.refreshSecret': 'refresh-secret',
      'app.jwt.accessExpiresIn': '15m',
      'app.jwt.refreshExpiresIn': '7d',
    };
    return map[key];
  }),
};

const mockCacheService = {
  set: jest.fn(),
  get: jest.fn(),
  del: jest.fn(),
  delByPattern: jest.fn(),
};

const mockAuditService = {
  record: jest.fn().mockResolvedValue({}),
};

// ── Test Suite ────────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
        { provide: CacheService, useValue: mockCacheService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // ── validateUser ────────────────────────────────────────────────────────────

  describe('validateUser', () => {
    it('returns user when credentials are valid', async () => {
      const hash = await hashPassword('correct-password');
      const user = buildUser({ password_hash: hash });
      mockPrisma.user.findFirst.mockResolvedValue(user);

      const result = await service.validateUser('test@example.com', 'correct-password');

      expect(result).not.toBeNull();
      expect(result?.email).toBe('test@example.com');
    });

    it('returns null when user is not found', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const result = await service.validateUser('unknown@example.com', 'any');

      expect(result).toBeNull();
    });

    it('returns null when password is wrong', async () => {
      const hash = await hashPassword('correct-password');
      const user = buildUser({ password_hash: hash });
      mockPrisma.user.findFirst.mockResolvedValue(user);

      const result = await service.validateUser('test@example.com', 'wrong-password');

      expect(result).toBeNull();
    });
  });

  // ── login ───────────────────────────────────────────────────────────────────

  describe('login', () => {
    it('returns tokens and user info on valid credentials', async () => {
      const hash = await hashPassword('secret');
      const user = buildUser({ password_hash: hash });
      mockPrisma.user.findFirst.mockResolvedValue(user);
      mockJwtService.sign
        .mockReturnValueOnce('access-token-value')
        .mockReturnValueOnce('refresh-token-value');
      mockCacheService.set.mockResolvedValue(undefined);

      const result = await service.login('test@example.com', 'secret') as import('./auth.service').LoginResult;

      expect(result.accessToken).toBe('access-token-value');
      expect(result.refreshToken).toBe('refresh-token-value');
      expect(result.user.email).toBe('test@example.com');
      expect(result.user.roles).toEqual(['Finance_Staff']);
    });

    it('throws UnauthorizedException for invalid credentials', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(service.login('bad@example.com', 'wrong')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when account is disabled', async () => {
      const hash = await hashPassword('secret');
      const user = buildUser({ password_hash: hash, is_active: false });
      mockPrisma.user.findFirst.mockResolvedValue(user);

      await expect(service.login('test@example.com', 'secret')).rejects.toThrow(
        new UnauthorizedException('Account is disabled'),
      );
    });

    it('stores refresh token in Redis with 7-day TTL', async () => {
      const hash = await hashPassword('secret');
      const user = buildUser({ password_hash: hash });
      mockPrisma.user.findFirst.mockResolvedValue(user);
      mockJwtService.sign.mockReturnValue('token');
      mockCacheService.set.mockResolvedValue(undefined);

      await service.login('test@example.com', 'secret');

      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.stringMatching(/^auth:refresh:user-uuid-1:/),
        1,
        7 * 24 * 60 * 60,
      );
    });
  });

  // ── issueTokens ─────────────────────────────────────────────────────────────

  describe('issueTokens', () => {
    it('signs access token with access secret and 15m expiry', async () => {
      mockJwtService.sign.mockReturnValue('token');
      mockCacheService.set.mockResolvedValue(undefined);

      await service.issueTokens('uid', 'u@e.com', ['Owner'], null);

      const accessCall = mockJwtService.sign.mock.calls[0];
      expect(accessCall[0].type).toBe('access');
      expect(accessCall[1]).toMatchObject({ secret: 'access-secret', expiresIn: '15m' });
    });

    it('signs refresh token with refresh secret and 7d expiry', async () => {
      mockJwtService.sign.mockReturnValue('token');
      mockCacheService.set.mockResolvedValue(undefined);

      await service.issueTokens('uid', 'u@e.com', ['Owner'], null);

      const refreshCall = mockJwtService.sign.mock.calls[1];
      expect(refreshCall[0].type).toBe('refresh');
      expect(refreshCall[1]).toMatchObject({ secret: 'refresh-secret', expiresIn: '7d' });
    });

    it('includes jti in both token payloads', async () => {
      mockJwtService.sign.mockReturnValue('token');
      mockCacheService.set.mockResolvedValue(undefined);

      await service.issueTokens('uid', 'u@e.com', ['Owner'], null);

      const accessPayload = mockJwtService.sign.mock.calls[0][0];
      const refreshPayload = mockJwtService.sign.mock.calls[1][0];
      expect(accessPayload.jti).toBeDefined();
      expect(refreshPayload.jti).toBeDefined();
      // access and refresh jti should be different
      expect(accessPayload.jti).not.toBe(refreshPayload.jti);
    });
  });

  // ── refreshTokens ───────────────────────────────────────────────────────────

  describe('refreshTokens', () => {
    it('issues new token pair when refresh token is valid', async () => {
      const payload = {
        sub: 'user-uuid-1',
        email: 'test@example.com',
        roles: ['Finance_Staff'],
        branch_id: null,
        type: 'refresh' as const,
        jti: 'old-jti',
      };
      mockJwtService.verify.mockReturnValue(payload);
      mockCacheService.get.mockResolvedValue(1);
      mockCacheService.del.mockResolvedValue(undefined);
      mockJwtService.sign
        .mockReturnValueOnce('new-access-token')
        .mockReturnValueOnce('new-refresh-token');
      mockCacheService.set.mockResolvedValue(undefined);

      const result = await service.refreshTokens('valid-refresh-token');

      expect(result.accessToken).toBe('new-access-token');
      expect(result.refreshToken).toBe('new-refresh-token');
      // old key deleted
      expect(mockCacheService.del).toHaveBeenCalledWith('auth:refresh:user-uuid-1:old-jti');
    });

    it('throws UnauthorizedException when refresh token is expired/invalid', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(service.refreshTokens('expired-token')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when refresh token is revoked (not in Redis)', async () => {
      const payload = {
        sub: 'user-uuid-1',
        email: 'test@example.com',
        roles: [],
        branch_id: null,
        type: 'refresh' as const,
        jti: 'revoked-jti',
      };
      mockJwtService.verify.mockReturnValue(payload);
      mockCacheService.get.mockResolvedValue(null);

      await expect(service.refreshTokens('revoked-token')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when token type is not refresh', async () => {
      const payload = {
        sub: 'user-uuid-1',
        email: 'test@example.com',
        roles: [],
        branch_id: null,
        type: 'access' as const,
        jti: 'some-jti',
      };
      mockJwtService.verify.mockReturnValue(payload);

      await expect(service.refreshTokens('access-token-used-as-refresh')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ── logout ──────────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('deletes the specific Redis key for the session', async () => {
      mockCacheService.del.mockResolvedValue(undefined);

      await service.logout('user-uuid-1', 'jti-abc');

      expect(mockCacheService.del).toHaveBeenCalledWith('auth:refresh:user-uuid-1:jti-abc');
    });
  });

  // ── invalidateAllSessions ───────────────────────────────────────────────────

  describe('invalidateAllSessions', () => {
    it('deletes all Redis keys matching the user pattern', async () => {
      mockCacheService.delByPattern.mockResolvedValue(undefined);

      await service.invalidateAllSessions('user-uuid-1');

      expect(mockCacheService.delByPattern).toHaveBeenCalledWith('auth:refresh:user-uuid-1:*');
    });
  });

  // ── changePassword ──────────────────────────────────────────────────────────

  describe('changePassword', () => {
    it('updates password hash and invalidates all sessions on success', async () => {
      const hash = await hashPassword('old-password');
      const txUpdate = jest.fn().mockResolvedValue({});
      const tx = { user: { update: txUpdate } };
      mockPrisma.user.findFirst.mockResolvedValue(buildUser({ password_hash: hash }));
      (mockPrisma.$transaction as jest.Mock).mockImplementation(
        async (cb: (t: unknown) => Promise<unknown>) => cb(tx),
      );
      mockAuditService.record.mockResolvedValue({});
      mockCacheService.delByPattern.mockResolvedValue(undefined);

      await service.changePassword('user-uuid-1', 'old-password', 'new-password-123');

      expect(txUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-uuid-1' },
          data: expect.objectContaining({ password_hash: expect.any(String) }),
        }),
      );
      expect(mockCacheService.delByPattern).toHaveBeenCalledWith('auth:refresh:user-uuid-1:*');
    });

    it('throws BadRequestException when current password is wrong', async () => {
      const hash = await hashPassword('correct-password');
      mockPrisma.user.findFirst.mockResolvedValue(buildUser({ password_hash: hash }));

      await expect(
        service.changePassword('user-uuid-1', 'wrong-password', 'new-password-123'),
      ).rejects.toThrow('Current password is incorrect');
    });

    it('throws UnauthorizedException when user is not found', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.changePassword('ghost-id', 'any', 'new-password-123'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('stores new password with bcrypt cost factor 12', async () => {
      const hash = await hashPassword('old-password');
      const txUpdate = jest.fn().mockResolvedValue({});
      const tx = { user: { update: txUpdate } };
      mockPrisma.user.findFirst.mockResolvedValue(buildUser({ password_hash: hash }));
      (mockPrisma.$transaction as jest.Mock).mockImplementation(
        async (cb: (t: unknown) => Promise<unknown>) => cb(tx),
      );
      mockAuditService.record.mockResolvedValue({});
      mockCacheService.delByPattern.mockResolvedValue(undefined);

      await service.changePassword('user-uuid-1', 'old-password', 'new-password-123');

      const updateCall = (txUpdate as jest.Mock).mock.calls[0][0];
      const newHash: string = updateCall.data.password_hash;
      // bcrypt hash with cost 12 starts with $2b$12$
      expect(newHash).toMatch(/^\$2b\$12\$/);
    });

    it('writes audit log inside the same transaction as the password update', async () => {
      const hash = await hashPassword('old-password');
      const txUpdate = jest.fn().mockResolvedValue({});
      const txAuditCreate = jest.fn().mockResolvedValue({});
      const tx = {
        user: { update: txUpdate },
        auditLog: { create: txAuditCreate },
      };
      mockPrisma.user.findFirst.mockResolvedValue(buildUser({ password_hash: hash }));
      (mockPrisma.$transaction as jest.Mock).mockImplementation(
        async (cb: (t: unknown) => Promise<unknown>) => cb(tx),
      );
      mockAuditService.record.mockImplementation(
        (_event: unknown, txArg: unknown) => {
          // Verify the tx client was forwarded to audit.record
          expect(txArg).toBe(tx);
          return Promise.resolve({});
        },
      );
      mockCacheService.delByPattern.mockResolvedValue(undefined);

      await service.changePassword('user-uuid-1', 'old-password', 'new-password-123');

      expect(mockAuditService.record).toHaveBeenCalledTimes(1);
    });
  });
});
