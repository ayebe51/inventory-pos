import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const RedisConfigSchema = z.object({
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_CLUSTER_NODES: z.string().optional(), // comma-separated: "host1:port1,host2:port2"
  CACHE_TTL_SECONDS: z.coerce.number().default(300),
});

export type RedisEnvConfig = z.infer<typeof RedisConfigSchema>;

export function validateRedisConfig(config: Record<string, unknown>): RedisEnvConfig {
  const result = RedisConfigSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Redis configuration validation failed:\n${result.error.toString()}`);
  }
  return result.data;
}

export const redisConfig = registerAs('redis', () => {
  const clusterNodes = process.env.REDIS_CLUSTER_NODES;
  const isCluster = Boolean(clusterNodes && clusterNodes.trim().length > 0);

  const nodes = isCluster
    ? clusterNodes!.split(',').map((node) => {
        const [host, port] = node.trim().split(':');
        return { host, port: parseInt(port ?? '6379', 10) };
      })
    : [];

  return {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD,
    isCluster,
    clusterNodes: nodes,
    ttlSeconds: parseInt(process.env.CACHE_TTL_SECONDS ?? '300', 10),
  };
});

export interface RedisConfig {
  host: string;
  port: number;
  password: string | undefined;
  isCluster: boolean;
  clusterNodes: { host: string; port: number }[];
  ttlSeconds: number;
}
