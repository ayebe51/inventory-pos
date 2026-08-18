import { validateAppConfig } from './app.config';

describe('P0-001 JWT Secret Security Validation', () => {
  const validBaseConfig = {
    PORT: 3000,
    NODE_ENV: 'development',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    REDIS_URL: 'redis://localhost:6379',
    JWT_ACCESS_SECRET: 'e7d3a8b4f1c92e5a6b8d0f3e5a1c9b2d4e6f8a0b2c4d6e8f1a3b5c7d9e1f3a5b',
    JWT_REFRESH_SECRET: 'a1b2c3d4e5f67890123456789abcdef0123456789abcdef0123456789abcdef0',
  };

  it('accepts valid 256-bit strong non-default secrets', () => {
    const validated = validateAppConfig(validBaseConfig);
    expect(validated.JWT_ACCESS_SECRET).toBe(validBaseConfig.JWT_ACCESS_SECRET);
  });

  it('rejects known default access secret "your-access-secret"', () => {
    expect(() =>
      validateAppConfig({
        ...validBaseConfig,
        JWT_ACCESS_SECRET: 'your-access-secret',
      }),
    ).toThrow(/JWT_ACCESS_SECRET cannot use a known default secret value/);
  });

  it('rejects known default access secret "super_secret_access_token"', () => {
    expect(() =>
      validateAppConfig({
        ...validBaseConfig,
        JWT_ACCESS_SECRET: 'super_secret_access_token',
      }),
    ).toThrow(/JWT_ACCESS_SECRET cannot use a known default secret value/);
  });

  it('rejects known default refresh secret "your-refresh-secret"', () => {
    expect(() =>
      validateAppConfig({
        ...validBaseConfig,
        JWT_REFRESH_SECRET: 'your-refresh-secret',
      }),
    ).toThrow(/JWT_REFRESH_SECRET cannot use a known default secret value/);
  });

  it('rejects weak secrets (< 32 chars) in production mode', () => {
    expect(() =>
      validateAppConfig({
        ...validBaseConfig,
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'short_secret_under_32_chars',
      }),
    ).toThrow(/at least 32 characters long in production mode/);
  });
});
