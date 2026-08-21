import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
  Inject,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CacheService } from '../../services/cache/cache.service';
import { IDEMPOTENCY_META_KEY, IdempotencyOptions } from '../decorators/idempotency.decorator';

const DEFAULT_TTL_SECONDS = 86400; // 24 hours
const inFlightLocks = new Map<string, Promise<any>>();

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly logger = new Logger(IdempotencyInterceptor.name);

  // In-memory fallback map if CacheService / Redis is unavailable
  private readonly memoryStore = new Map<string, { response: any; expiresAt: number }>();

  constructor(
    private readonly reflector: Reflector,
    @Optional() @Inject(CacheService) private readonly cacheService?: CacheService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;

    // Only process mutating HTTP methods
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const options = this.reflector.getAllAndOverride<IdempotencyOptions>(IDEMPOTENCY_META_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const headerName = options?.headerName?.toLowerCase() || 'idempotency-key';
    const rawKey = request.headers[headerName] || request.headers['x-idempotency-key'] || request.headers['idempotency-key'];

    if (!rawKey || typeof rawKey !== 'string' || !rawKey.trim()) {
      return next.handle();
    }

    const ttl = options?.ttlSeconds ?? DEFAULT_TTL_SECONDS;
    const cleanKey = rawKey.trim();
    const cacheKey = `idempotency:${method}:${request.path}:${cleanKey}`;

    // 1. Check in-flight lock (protect against parallel requests within milliseconds)
    if (inFlightLocks.has(cacheKey)) {
      this.logger.log(`IdempotencyInterceptor: waiting for in-flight request for key ${cleanKey}`);
      try {
        const result = await inFlightLocks.get(cacheKey);
        return of(result);
      } catch (err) {
        // If the in-flight request failed, allow re-execution
      }
    }

    // 2. Check cached response
    const cachedResponse = await this.getFromCache(cacheKey);
    if (cachedResponse !== null) {
      this.logger.log(`IdempotencyInterceptor: cache hit for key ${cleanKey} on ${method} ${request.path}`);
      return of(cachedResponse);
    }

    // 3. Create in-flight execution promise
    let resolveInFlight: (val: any) => void;
    let rejectInFlight: (err: any) => void;
    const inFlightPromise = new Promise((resolve, reject) => {
      resolveInFlight = resolve;
      rejectInFlight = reject;
    });

    inFlightLocks.set(cacheKey, inFlightPromise);

    return next.handle().pipe(
      tap({
        next: async (response) => {
          try {
            await this.setToCache(cacheKey, response, ttl);
            resolveInFlight(response);
          } catch (err) {
            resolveInFlight(response);
          } finally {
            inFlightLocks.delete(cacheKey);
          }
        },
        error: (err) => {
          rejectInFlight(err);
          inFlightLocks.delete(cacheKey);
        },
      }),
    );
  }

  private async getFromCache(key: string): Promise<any | null> {
    if (this.cacheService) {
      const value = await this.cacheService.get<any>(key);
      if (value !== null) return value;
    }

    // Fallback in-memory check
    const entry = this.memoryStore.get(key);
    if (entry) {
      if (Date.now() > entry.expiresAt) {
        this.memoryStore.delete(key);
        return null;
      }
      return entry.response;
    }

    return null;
  }

  private async setToCache(key: string, value: any, ttlSeconds: number): Promise<void> {
    if (this.cacheService) {
      await this.cacheService.set(key, value, ttlSeconds);
    }

    // Always store in memory fallback
    this.memoryStore.set(key, {
      response: value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }
}
