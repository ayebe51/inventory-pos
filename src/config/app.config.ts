import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const KNOWN_DEFAULT_SECRETS = new Set([
  'your-access-secret',
  'your-refresh-secret',
  'super_secret_access_token',
  'super_secret_refresh_token',
  'secret',
  'change_me',
  'default_secret',
  '123456',
]);

const AppConfigSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().url(),
  DATABASE_REPLICA_URL: z.string().url().optional(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_ACCESS_SECRET: z.string().min(1, 'JWT_ACCESS_SECRET is required'),
  JWT_REFRESH_SECRET: z.string().min(1, 'JWT_REFRESH_SECRET is required'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
}).superRefine((data, ctx) => {
  const isProd = data.NODE_ENV === 'production';
  
  // Check access secret
  if (KNOWN_DEFAULT_SECRETS.has(data.JWT_ACCESS_SECRET.toLowerCase())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'JWT_ACCESS_SECRET cannot use a known default secret value',
      path: ['JWT_ACCESS_SECRET'],
    });
  } else if (isProd && data.JWT_ACCESS_SECRET.length < 32) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'JWT_ACCESS_SECRET must be at least 32 characters long in production mode',
      path: ['JWT_ACCESS_SECRET'],
    });
  }

  // Check refresh secret
  if (KNOWN_DEFAULT_SECRETS.has(data.JWT_REFRESH_SECRET.toLowerCase())) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'JWT_REFRESH_SECRET cannot use a known default secret value',
      path: ['JWT_REFRESH_SECRET'],
    });
  } else if (isProd && data.JWT_REFRESH_SECRET.length < 32) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'JWT_REFRESH_SECRET must be at least 32 characters long in production mode',
      path: ['JWT_REFRESH_SECRET'],
    });
  }
});

export type AppConfig = z.infer<typeof AppConfigSchema>;

export function validateAppConfig(config: Record<string, unknown>): AppConfig {
  const result = AppConfigSchema.safeParse(config);
  if (!result.success) {
    throw new Error(`Configuration validation failed:\n${result.error.toString()}`);
  }
  return result.data;
}

export const appConfig = registerAs('app', () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  redis: {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
}));

