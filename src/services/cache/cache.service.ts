import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { Cluster } from 'ioredis';
import * as crypto from 'crypto';

const DEFAULT_TTL_SECONDS = 300; // 5 minutes

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private client: Redis | Cluster;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const isCluster = this.configService.get<boolean>('redis.isCluster');
    const password = this.configService.get<string>('redis.password');

    if (isCluster) {
      const nodes = this.configService.get<{ host: string; port: number }[]>('redis.clusterNodes') ?? [];
      this.client = new Cluster(nodes, {
        redisOptions: { password },
        enableOfflineQueue: false,
      });
      this.logger.log(`Redis Cluster initialized with ${nodes.length} nodes`);
    } else {
      const host = this.configService.get<string>('redis.host') ?? 'localhost';
      const port = this.configService.get<number>('redis.port') ?? 6379;
      this.client = new Redis({ host, port, password, enableOfflineQueue: false, lazyConnect: true });
      this.logger.log(`Redis single-node initialized at ${host}:${port}`);
    }

    this.client.on('error', (err) => {
      this.logger.error(`Redis error: ${err.message}`);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(key);
      if (value === null) return null;
      return JSON.parse(value) as T;
    } catch (err) {
      this.logger.warn(`Cache GET failed for key "${key}": ${(err as Error).message}`);
      return null;
    }
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds ?? this.configService.get<number>('redis.ttlSeconds') ?? DEFAULT_TTL_SECONDS;
    try {
      await this.client.set(key, JSON.stringify(value), 'EX', ttl);
    } catch (err) {
      this.logger.warn(`Cache SET failed for key "${key}": ${(err as Error).message}`);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (err) {
      this.logger.warn(`Cache DEL failed for key "${key}": ${(err as Error).message}`);
    }
  }

  async delByPattern(pattern: string): Promise<void> {
    try {
      if (this.client instanceof Cluster) {
        // For cluster mode, scan each master node
        const nodes = this.client.nodes('master');
        await Promise.all(nodes.map((node) => this.scanAndDelete(node, pattern)));
      } else {
        await this.scanAndDelete(this.client as Redis, pattern);
      }
    } catch (err) {
      this.logger.warn(`Cache DEL by pattern "${pattern}" failed: ${(err as Error).message}`);
    }
  }

  private async scanAndDelete(client: Redis, pattern: string): Promise<void> {
    let cursor = '0';
    do {
      const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await client.del(...keys);
      }
    } while (cursor !== '0');
  }

  // ── Key helpers for master data ──────────────────────────────────────────

  masterKey(entity: string, id: string): string {
    return `master:${entity}:${id}`;
  }

  masterListKey(entity: string, filters: Record<string, unknown>): string {
    const hash = crypto
      .createHash('md5')
      .update(JSON.stringify(filters))
      .digest('hex')
      .slice(0, 8);
    return `master:${entity}:list:${hash}`;
  }

  masterPattern(entity: string): string {
    return `master:${entity}:*`;
  }
}
