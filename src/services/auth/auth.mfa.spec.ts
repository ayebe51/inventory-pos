import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import { AuthService } from './auth.service';
import { PrismaService } from '../../config/prisma.service';
import { CacheService } from '../cache/cache.service';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

function buildUser(overrides: Partial<{
  roles: string[];
  mfa_enabled: boolean;
  mfa_secret: string | null;
  is_active: boolean;
  password_hash: string;
}> = {}) {
  const roles = overrides.roles ?? ['Finance_Staff'];
  return {
    id: 'user-uuid-1',
    email: 'test@example.com',
    full_name: 'Test User',
    password_hash: overrides.password_hash ?? '$2b$12$placeholder',
    is_active: overrides.is_active ?? true,
    branch_id: null,
    deleted_at: null,
    mfa_enabled: overrides.mfa_enabled ?? false,
    mfa_secret: overrides.mfa_secret ?? null,
    user_roles: roles.map((r) => ({ role: { name: r } })),
  };
}

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPrisma = {
  user: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('token'),
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
  set: jest.fn().mockResolvedValue(undefined),
  get: jest.fn(),
  del: jest.fn().mockResolvedValue(undefined),
  delByPattern: jest.fn().mockResolvedValue(undefined),
};

// ── Test Suite ────────────────────────────────────────────────────────────────

describe('AuthService — MFA (TOTP)', () => {
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
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // ── login — MFA required roles ──────────────────────────────────────────────

  describe('login — MFA-required roles', () => {
    const mfaRoles = ['Owner', 'Finance_Manager', 'Auditor'];

    it.each(mfaRoles)(
      'returns mfaRequired=true for role %s when MFA is enrolled',
      async (role) => {
        const hash = await hashPassword('secret');
        const secret = authenticator.generateSecret();
        const user = buildUser({ roles: [role], password_hash: hash, mfa_enabled: true, mfa_secret: secret });
        mockPrisma.user.findFirst.mockResolvedValue(user);

        const result = await service.login('test@example.com', 'secret');

        expect(result).toMatchObject({ mfaRequired: true });
        expect((result as { mfaToken: string }).mfaToken).toBeDefined();
      },
    );

    it.each(mfaRoles)(
      'returns mfaRequired=true for role %s when MFA is NOT yet enrolled (setup flow)',
      async (role) => {
        const hash = await hashPassword('secret');
        const user = buildUser({ roles: [role], password_hash: hash, mfa_enabled: false, mfa_secret: null });
        mockPrisma.user.findFirst.mockResolvedValue(user);

        const result = await service.login('test@example.com', 'secret');

        expect(result).toMatchObject({ mfaRequired: true });
        expect((result as { mfaToken: string }).mfaToken).toBeDefined();
      },
    );

    it('returns full tokens directly for non-MFA roles (e.g. Cashier)', async () => {
      const hash = await hashPassword('secret');
      const user = buildUser({ roles: ['Cashier'], password_hash: hash });
      mockPrisma.user.findFirst.mockResolvedValue(user);

      const result = await service.login('test@example.com', 'secret');

      expect(result).not.toHaveProperty('mfaRequired');
      expect((result as { accessToken: string }).accessToken).toBeDefined();
    });

    it('stores MFA token in Redis with 5-minute TTL', async () => {
      const hash = await hashPassword('secret');
      const secret = authenticator.generateSecret();
      const user = buildUser({ roles: ['Owner'], password_hash: hash, mfa_enabled: true, mfa_secret: secret });
      mockPrisma.user.findFirst.mockResolvedValue(user);

      await service.login('test@example.com', 'secret');

      expect(mockCacheService.set).toHaveBeenCalledWith(
        expect.stringMatching(/^auth:mfa:token:/),
        'user-uuid-1',
        5 * 60,
      );
    });
  });

  // ── verifyMfa ───────────────────────────────────────────────────────────────

  describe('verifyMfa', () => {
    it('returns full tokens when TOTP code is valid', async () => {
      const secret = authenticator.generateSecret();
      const validCode = authenticator.generate(secret);
      const user = buildUser({ roles: ['Owner'], mfa_enabled: true, mfa_secret: secret });

      mockCacheService.get.mockResolvedValueOnce('user-uuid-1'); // mfa token lookup
      mockPrisma.user.findFirst.mockResolvedValue(user);

      const result = await service.verifyMfa('mfa-token-uuid', validCode);

      expect(result.accessToken).toBeDefined();
      expect(result.user.id).toBe('user-uuid-1');
    });

    it('throws UnauthorizedException when TOTP code is invalid', async () => {
      const secret = authenticator.generateSecret();
      const user = buildUser({ roles: ['Owner'], mfa_enabled: true, mfa_secret: secret });

      mockCacheService.get.mockResolvedValueOnce('user-uuid-1');
      mockPrisma.user.findFirst.mockResolvedValue(user);

      await expect(service.verifyMfa('mfa-token-uuid', '000000')).rejects.toThrow(
        new UnauthorizedException('Invalid TOTP code'),
      );
    });

    it('throws UnauthorizedException when mfaToken is expired or not found', async () => {
      mockCacheService.get.mockResolvedValueOnce(null);

      await expect(service.verifyMfa('expired-token', '123456')).rejects.toThrow(
        new UnauthorizedException('MFA token is invalid or expired'),
      );
    });

    it('consumes the MFA token after successful verification (one-time use)', async () => {
      const secret = authenticator.generateSecret();
      const validCode = authenticator.generate(secret);
      const user = buildUser({ roles: ['Finance_Manager'], mfa_enabled: true, mfa_secret: secret });

      mockCacheService.get.mockResolvedValueOnce('user-uuid-1');
      mockPrisma.user.findFirst.mockResolvedValue(user);

      await service.verifyMfa('mfa-token-uuid', validCode);

      expect(mockCacheService.del).toHaveBeenCalledWith('auth:mfa:token:mfa-token-uuid');
    });

    it('throws UnauthorizedException when user has no MFA secret', async () => {
      const user = buildUser({ roles: ['Auditor'], mfa_enabled: false, mfa_secret: null });

      mockCacheService.get.mockResolvedValueOnce('user-uuid-1');
      mockPrisma.user.findFirst.mockResolvedValue(user);

      await expect(service.verifyMfa('mfa-token-uuid', '123456')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  // ── setupMfa ────────────────────────────────────────────────────────────────

  describe('setupMfa', () => {
    it('returns a secret and otpauth URL', async () => {
      const user = buildUser({ roles: ['Owner'], mfa_enabled: false, mfa_secret: null });
      mockCacheService.get.mockResolvedValueOnce('user-uuid-1');
      mockPrisma.user.findFirst.mockResolvedValue(user);

      const result = await service.setupMfa('mfa-token-uuid');

      expect(result.secret).toBeDefined();
      expect(result.otpauthUrl).toMatch(/^otpauth:\/\/totp\//);
    });

    it('throws UnauthorizedException when mfaToken is invalid', async () => {
      mockCacheService.get.mockResolvedValueOnce(null);

      await expect(service.setupMfa('bad-token')).rejects.toThrow(UnauthorizedException);
    });

    it('stores pending secret in Redis with 5-minute TTL', async () => {
      const user = buildUser({ roles: ['Owner'], mfa_enabled: false, mfa_secret: null });
      mockCacheService.get.mockResolvedValueOnce('user-uuid-1');
      mockPrisma.user.findFirst.mockResolvedValue(user);

      await service.setupMfa('mfa-token-uuid');

      expect(mockCacheService.set).toHaveBeenCalledWith(
        'auth:mfa:pending:user-uuid-1',
        expect.any(String),
        5 * 60,
      );
    });
  });

  // ── confirmMfaSetup ─────────────────────────────────────────────────────────

  describe('confirmMfaSetup', () => {
    it('persists mfa_secret and mfa_enabled=true on valid TOTP code', async () => {
      const secret = authenticator.generateSecret();
      const validCode = authenticator.generate(secret);
      const user = buildUser({ roles: ['Finance_Manager'], mfa_enabled: false, mfa_secret: null });

      mockCacheService.get
        .mockResolvedValueOnce('user-uuid-1')   // mfa token lookup
        .mockResolvedValueOnce(secret);          // pending secret lookup
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.user.findFirst.mockResolvedValue({
        ...user,
        mfa_enabled: true,
        mfa_secret: secret,
      });

      const result = await service.confirmMfaSetup('mfa-token-uuid', validCode);

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-uuid-1' },
          data: { mfa_secret: secret, mfa_enabled: true },
        }),
      );
      expect(result.accessToken).toBeDefined();
    });

    it('throws UnauthorizedException when TOTP code is invalid during setup confirm', async () => {
      const secret = authenticator.generateSecret();
      const user = buildUser({ roles: ['Owner'], mfa_enabled: false, mfa_secret: null });

      mockCacheService.get
        .mockResolvedValueOnce('user-uuid-1')
        .mockResolvedValueOnce(secret);
      mockPrisma.user.findFirst.mockResolvedValue(user);

      await expect(service.confirmMfaSetup('mfa-token-uuid', '000000')).rejects.toThrow(
        new UnauthorizedException('Invalid TOTP code'),
      );
    });

    it('throws BadRequestException when no pending setup secret exists', async () => {
      mockCacheService.get
        .mockResolvedValueOnce('user-uuid-1')
        .mockResolvedValueOnce(null); // no pending secret

      await expect(service.confirmMfaSetup('mfa-token-uuid', '123456')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('cleans up both mfa token and pending secret from Redis after success', async () => {
      const secret = authenticator.generateSecret();
      const validCode = authenticator.generate(secret);
      const user = buildUser({ roles: ['Auditor'], mfa_enabled: false, mfa_secret: null });

      mockCacheService.get
        .mockResolvedValueOnce('user-uuid-1')
        .mockResolvedValueOnce(secret);
      mockPrisma.user.update.mockResolvedValue({});
      mockPrisma.user.findFirst.mockResolvedValue({
        ...user,
        mfa_enabled: true,
        mfa_secret: secret,
      });

      await service.confirmMfaSetup('mfa-token-uuid', validCode);

      expect(mockCacheService.del).toHaveBeenCalledWith('auth:mfa:token:mfa-token-uuid');
      expect(mockCacheService.del).toHaveBeenCalledWith('auth:mfa:pending:user-uuid-1');
    });
  });
});
