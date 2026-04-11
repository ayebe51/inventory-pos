import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../config/prisma.service';
import { CacheService } from '../cache/cache.service';
import { AuditService } from '../audit/audit.service';

export interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
  branch_id: string | null;
  type: 'access' | 'refresh';
  jti: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResult extends TokenPair {
  user: {
    id: string;
    email: string;
    full_name: string;
    roles: string[];
    branch_id: string | null;
  };
}

export interface LoginResultMfaPending {
  mfaRequired: true;
  mfaToken: string;
}

export type LoginResponse = LoginResult | LoginResultMfaPending;

export interface MfaSetupResult {
  secret: string;
  otpauthUrl: string;
}

/** Roles that require MFA (TOTP) before full access is granted */
const MFA_REQUIRED_ROLES = new Set(['Owner', 'Finance_Manager', 'Auditor']);

const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const MFA_TOKEN_TTL_SECONDS = 5 * 60; // 5 minutes

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
    private readonly auditService: AuditService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: { email, deleted_at: null },
      include: {
        user_roles: {
          include: { role: true },
        },
      },
    });

    if (!user) return null;

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return null;

    return user;
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    const user = await this.validateUser(email, password);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.is_active) {
      throw new UnauthorizedException('Account is disabled');
    }

    const roles = user.user_roles.map((ur) => ur.role.name);

    // Check if any of the user's roles require MFA
    const requiresMfa = roles.some((r) => MFA_REQUIRED_ROLES.has(r));

    if (requiresMfa) {
      if (!user.mfa_enabled || !user.mfa_secret) {
        // MFA not yet set up — issue a short-lived setup token so the user can enroll
        const mfaToken = await this.issueMfaToken(user.id, 'setup');
        return { mfaRequired: true, mfaToken };
      }

      // MFA enrolled — require TOTP verification before issuing full tokens
      const mfaToken = await this.issueMfaToken(user.id, 'verify');
      return { mfaRequired: true, mfaToken };
    }

    const tokens = await this.issueTokens(user.id, user.email, roles, user.branch_id ?? null);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        roles,
        branch_id: user.branch_id ?? null,
      },
    };
  }

  /**
   * Issue a short-lived MFA token stored in Redis.
   * purpose: 'verify' = user has MFA enrolled, needs TOTP code
   *          'setup'  = user needs to enroll MFA first
   */
  async issueMfaToken(userId: string, purpose: 'verify' | 'setup'): Promise<string> {
    const token = uuidv4();
    // Store as auth:mfa:token:{token} → userId so verifyMfa/setupMfa can look up by token
    await this.cacheService.set(
      `auth:mfa:token:${token}`,
      userId,
      MFA_TOKEN_TTL_SECONDS,
    );
    // Also store purpose so the controller can direct the user to the right flow
    await this.cacheService.set(
      `auth:mfa:purpose:${token}`,
      purpose,
      MFA_TOKEN_TTL_SECONDS,
    );
    return token;
  }

  /**
   * Verify TOTP code and exchange mfaToken for full JWT tokens.
   */
  async verifyMfa(mfaToken: string, totpCode: string): Promise<LoginResult> {
    // Find the mfa token in Redis — key pattern: auth:mfa:{userId}:{token}
    // We scan by iterating; in practice the token is opaque so we embed userId in it
    // Instead, we store the token as: auth:mfa:token:{token} → userId
    const redisKey = `auth:mfa:token:${mfaToken}`;
    const userId = await this.cacheService.get<string>(redisKey);

    if (!userId) {
      throw new UnauthorizedException('MFA token is invalid or expired');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, deleted_at: null },
      include: { user_roles: { include: { role: true } } },
    });

    if (!user || !user.is_active) {
      throw new UnauthorizedException('User not found or disabled');
    }

    if (!user.mfa_secret || !user.mfa_enabled) {
      throw new UnauthorizedException('MFA is not set up for this account');
    }

    const isValid = authenticator.verify({ token: totpCode, secret: user.mfa_secret });
    if (!isValid) {
      throw new UnauthorizedException('Invalid TOTP code');
    }

    // Consume the MFA token (one-time use)
    await this.cacheService.del(redisKey);

    const roles = user.user_roles.map((ur) => ur.role.name);
    const tokens = await this.issueTokens(user.id, user.email, roles, user.branch_id ?? null);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        roles,
        branch_id: user.branch_id ?? null,
      },
    };
  }

  /**
   * Generate a new TOTP secret and return the otpauth URL for QR code display.
   * The secret is NOT saved until the user confirms with a valid TOTP code.
   */
  async setupMfa(mfaToken: string): Promise<MfaSetupResult> {
    const redisKey = `auth:mfa:token:${mfaToken}`;
    const userId = await this.cacheService.get<string>(redisKey);

    if (!userId) {
      throw new UnauthorizedException('MFA token is invalid or expired');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: userId, deleted_at: null },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(user.email, 'Enterprise ERP', secret);

    // Store pending secret temporarily (5 min) — confirmed in confirmMfaSetup
    await this.cacheService.set(
      `auth:mfa:pending:${userId}`,
      secret,
      MFA_TOKEN_TTL_SECONDS,
    );

    return { secret, otpauthUrl };
  }

  /**
   * Confirm MFA setup by verifying the first TOTP code against the pending secret.
   * Persists mfa_secret and sets mfa_enabled = true.
   */
  async confirmMfaSetup(mfaToken: string, totpCode: string): Promise<LoginResult> {
    const redisKey = `auth:mfa:token:${mfaToken}`;
    const userId = await this.cacheService.get<string>(redisKey);

    if (!userId) {
      throw new UnauthorizedException('MFA token is invalid or expired');
    }

    const pendingSecret = await this.cacheService.get<string>(`auth:mfa:pending:${userId}`);
    if (!pendingSecret) {
      throw new BadRequestException('No pending MFA setup found. Please restart setup.');
    }

    const isValid = authenticator.verify({ token: totpCode, secret: pendingSecret });
    if (!isValid) {
      throw new UnauthorizedException('Invalid TOTP code');
    }

    // Persist the secret
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfa_secret: pendingSecret, mfa_enabled: true },
    });

    // Clean up Redis keys
    await this.cacheService.del(redisKey);
    await this.cacheService.del(`auth:mfa:pending:${userId}`);

    const user = await this.prisma.user.findFirst({
      where: { id: userId, deleted_at: null },
      include: { user_roles: { include: { role: true } } },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const roles = user.user_roles.map((ur) => ur.role.name);
    const tokens = await this.issueTokens(user.id, user.email, roles, user.branch_id ?? null);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        roles,
        branch_id: user.branch_id ?? null,
      },
    };
  }

  async issueTokens(
    userId: string,
    email: string,
    roles: string[],
    branchId: string | null,
  ): Promise<TokenPair> {
    const accessJti = uuidv4();
    const refreshJti = uuidv4();

    const accessPayload: JwtPayload = {
      sub: userId,
      email,
      roles,
      branch_id: branchId,
      type: 'access',
      jti: accessJti,
    };

    const refreshPayload: JwtPayload = {
      sub: userId,
      email,
      roles,
      branch_id: branchId,
      type: 'refresh',
      jti: refreshJti,
    };

    const accessSecret = this.configService.get<string>('app.jwt.accessSecret');
    const refreshSecret = this.configService.get<string>('app.jwt.refreshSecret');
    const accessExpiresIn = this.configService.get<string>('app.jwt.accessExpiresIn') ?? '15m';
    const refreshExpiresIn = this.configService.get<string>('app.jwt.refreshExpiresIn') ?? '7d';

    const accessToken = this.jwtService.sign(accessPayload, {
      secret: accessSecret,
      expiresIn: accessExpiresIn,
    });

    const refreshToken = this.jwtService.sign(refreshPayload, {
      secret: refreshSecret,
      expiresIn: refreshExpiresIn,
    });

    // Store refresh token in Redis: auth:refresh:{userId}:{jti} → 1, TTL 7 days
    await this.cacheService.set(
      `auth:refresh:${userId}:${refreshJti}`,
      1,
      REFRESH_TTL_SECONDS,
    );

    return { accessToken, refreshToken };
  }

  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    const refreshSecret = this.configService.get<string>('app.jwt.refreshSecret');

    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(refreshToken, { secret: refreshSecret });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    const redisKey = `auth:refresh:${payload.sub}:${payload.jti}`;
    const stored = await this.cacheService.get<number>(redisKey);

    if (stored === null) {
      throw new UnauthorizedException('Refresh token has been revoked');
    }

    // Rotate: delete old key, issue new tokens
    await this.cacheService.del(redisKey);

    return this.issueTokens(payload.sub, payload.email, payload.roles, payload.branch_id);
  }

  async logout(userId: string, jti: string): Promise<void> {
    await this.cacheService.del(`auth:refresh:${userId}:${jti}`);
  }

  async invalidateAllSessions(userId: string): Promise<void> {
    await this.cacheService.delByPattern(`auth:refresh:${userId}:*`);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deleted_at: null },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      throw new BadRequestException('Current password is incorrect');
    }

    const newHash = await bcrypt.hash(newPassword, 12);

    // Write the password update and the audit log in the same DB transaction
    // so that if either fails, both are rolled back (Req 1 AC 12).
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { password_hash: newHash, updated_at: new Date() },
      });

      await this.auditService.record(
        {
          user_id: userId,
          action: 'UPDATE',
          entity_type: 'User',
          entity_id: userId,
          before_snapshot: { password_hash: '[REDACTED]' },
          after_snapshot: { password_hash: '[REDACTED]' },
          ip_address: ipAddress,
          user_agent: userAgent,
        },
        tx,
      );
    });

    // Invalidate all active sessions (requirement: AC-4)
    await this.invalidateAllSessions(userId);
  }
}
