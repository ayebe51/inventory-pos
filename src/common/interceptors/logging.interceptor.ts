import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const httpContext = context.switchToHttp();
    const req = httpContext.getRequest<Request>();
    const res = httpContext.getResponse<Response>();

    // 1. Correlation / Request ID resolution
    const correlationId = (req.headers['x-request-id'] as string) || randomUUID();
    res.setHeader('x-request-id', correlationId);

    const startTime = Date.now();
    const { method, originalUrl, ip } = req;
    const user = (req as any).user;
    const userId = user?.sub || user?.id || null;

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          const statusCode = res.statusCode;

          const logPayload = {
            timestamp: new Date().toISOString(),
            level: 'info',
            service: 'kiro-backend',
            requestId: correlationId,
            userId,
            method,
            route: originalUrl,
            statusCode,
            durationMs: duration,
            clientIp: ip,
          };

          if (process.env.NODE_ENV === 'production') {
            console.log(JSON.stringify(logPayload));
          } else {
            this.logger.log(`[${correlationId.slice(0, 8)}] ${method} ${originalUrl} ${statusCode} +${duration}ms`);
          }
        },
        error: (err) => {
          const duration = Date.now() - startTime;
          const statusCode = err.status || err.statusCode || 500;
          const errorCode = err.response?.errorCode || err.errorCode || 'INTERNAL_ERROR';

          const logPayload = {
            timestamp: new Date().toISOString(),
            level: 'error',
            service: 'kiro-backend',
            requestId: correlationId,
            userId,
            method,
            route: originalUrl,
            statusCode,
            durationMs: duration,
            errorCode,
            errorMessage: err.message,
            clientIp: ip,
          };

          if (process.env.NODE_ENV === 'production') {
            console.error(JSON.stringify(logPayload));
          } else {
            this.logger.error(
              `[${correlationId.slice(0, 8)}] ${method} ${originalUrl} ${statusCode} +${duration}ms - Error: ${err.message}`,
            );
          }
        },
      }),
    );
  }
}
