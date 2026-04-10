import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../config/prisma.service';
import { CacheService } from '../cache/cache.service';

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

const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
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

  async login(email: string, password: string): Promise<LoginResult> {
    const user = await this.validateUser(email, password);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.is_active) {
      throw new UnauthorizedException('Account is disabled');
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
}
