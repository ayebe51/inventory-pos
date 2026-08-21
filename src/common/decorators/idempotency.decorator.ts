import { SetMetadata } from '@nestjs/common';

export const IDEMPOTENCY_META_KEY = 'idempotency_options';

export interface IdempotencyOptions {
  ttlSeconds?: number;
  headerName?: string;
  enabled?: boolean;
}

/**
 * Decorator to enable or configure idempotency handling on a controller method.
 * Default TTL is 86400 seconds (24 hours).
 */
export const UseIdempotency = (options: IdempotencyOptions = {}) =>
  SetMetadata(IDEMPOTENCY_META_KEY, {
    ttlSeconds: 86400,
    headerName: 'x-idempotency-key',
    enabled: true,
    ...options,
  });
