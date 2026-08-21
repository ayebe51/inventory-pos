import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of } from 'rxjs';
import { IdempotencyInterceptor } from './idempotency.interceptor';

describe('IdempotencyInterceptor', () => {
  let interceptor: IdempotencyInterceptor;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    interceptor = new IdempotencyInterceptor(reflector);
  });

  const createMockContext = (method: string, path: string, headers: Record<string, string> = {}): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          method,
          path,
          headers,
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  };

  const createMockCallHandler = (responseData: any) => {
    const handleSpy = jest.fn().mockReturnValue(of(responseData));
    return {
      handle: handleSpy,
    } as unknown as CallHandler;
  };

  it('bypasses GET requests without idempotency check', async () => {
    const context = createMockContext('GET', '/api/v1/products');
    const handler = createMockCallHandler({ data: 'ok' });

    const result$ = await interceptor.intercept(context, handler);
    result$.subscribe((res) => {
      expect(res).toEqual({ data: 'ok' });
    });

    expect(handler.handle).toHaveBeenCalledTimes(1);
  });

  it('passes through POST requests without idempotency header', async () => {
    const context = createMockContext('POST', '/api/v1/payments');
    const handler = createMockCallHandler({ id: 'pmt-123' });

    const result$ = await interceptor.intercept(context, handler);
    result$.subscribe((res) => {
      expect(res).toEqual({ id: 'pmt-123' });
    });

    expect(handler.handle).toHaveBeenCalledTimes(1);
  });

  it('caches and returns cached response for repeated POST with same idempotency-key', async () => {
    const context = createMockContext('POST', '/api/v1/payments', {
      'x-idempotency-key': 'unique-key-001',
    });
    const handler = createMockCallHandler({ id: 'pmt-999', status: 'SUCCESS' });

    // First call -> handler executed
    const result1$ = await interceptor.intercept(context, handler);
    let firstResult: any;
    result1$.subscribe((res) => (firstResult = res));
    expect(firstResult).toEqual({ id: 'pmt-999', status: 'SUCCESS' });
    expect(handler.handle).toHaveBeenCalledTimes(1);

    // Second call -> returns cached response without calling handler again
    const result2$ = await interceptor.intercept(context, handler);
    let secondResult: any;
    result2$.subscribe((res) => (secondResult = res));
    expect(secondResult).toEqual({ id: 'pmt-999', status: 'SUCCESS' });
    expect(handler.handle).toHaveBeenCalledTimes(1); // Still 1!
  });
});
