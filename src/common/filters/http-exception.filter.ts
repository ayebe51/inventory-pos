import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorCode } from '../enums/error-codes.enum';
import { APIError } from '../types/api-response.type';

/**
 * Maps HTTP status codes to ErrorCode enum values per spec.
 */
function statusToErrorCode(status: number): ErrorCode {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return ErrorCode.VALIDATION_ERROR;
    case HttpStatus.UNAUTHORIZED:
      return ErrorCode.UNAUTHORIZED;
    case HttpStatus.FORBIDDEN:
      return ErrorCode.FORBIDDEN;
    case HttpStatus.NOT_FOUND:
      return ErrorCode.NOT_FOUND;
    case HttpStatus.UNPROCESSABLE_ENTITY:
      return ErrorCode.VALIDATION_ERROR;
    case HttpStatus.CONFLICT:
      return ErrorCode.CONFLICT;
    default:
      return ErrorCode.INTERNAL_ERROR;
  }
}

/**
 * Extracts a structured APIError from an HttpException response.
 * Handles both NestJS built-in exceptions and custom BusinessRuleException shapes.
 */
function extractErrorBody(
  exception: HttpException,
  fallbackStatus: number,
): APIError {
  const response = exception.getResponse();

  // Custom exceptions (BusinessRuleException, etc.) already return the full APIError shape
  if (
    typeof response === 'object' &&
    response !== null &&
    'success' in response &&
    'error' in response
  ) {
    return response as APIError;
  }

  // NestJS ValidationPipe returns { message: string[], error: string, statusCode: number }
  if (
    typeof response === 'object' &&
    response !== null &&
    'message' in response
  ) {
    const msg = (response as Record<string, unknown>).message;
    const isValidationArray = Array.isArray(msg);

    const code =
      fallbackStatus === HttpStatus.UNPROCESSABLE_ENTITY
        ? ErrorCode.VALIDATION_ERROR
        : statusToErrorCode(fallbackStatus);

    const details: Record<string, string[]> | undefined = isValidationArray
      ? { validation: msg as string[] }
      : undefined;

    let sanitizedMessage = isValidationArray ? 'Validation failed' : String(msg);
    if (
      typeof sanitizedMessage === 'string' &&
      (sanitizedMessage.includes('JSON at position') || sanitizedMessage.includes('SyntaxError'))
    ) {
      sanitizedMessage = 'Malformed JSON payload in request body';
    }

    return {
      success: false,
      error: {
        code,
        message: sanitizedMessage,
        ...(details ? { details } : {}),
      },
    };
  }

  // Plain string response
  let message = typeof response === 'string' ? response : 'An error occurred';
  if (
    typeof message === 'string' &&
    (message.includes('JSON at position') || message.includes('SyntaxError'))
  ) {
    message = 'Malformed JSON payload in request body';
  }

  return {
    success: false,
    error: {
      code: statusToErrorCode(fallbackStatus),
      message,
    },
  };
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = extractErrorBody(exception, status);

      if (status === HttpStatus.TOO_MANY_REQUESTS) {
        this.logger.warn(
          `[SECURITY_RATE_LIMIT] [${request.method}] ${request.url} from ${request.ip} exceeded rate limit threshold`,
        );
      } else if (status >= 500) {
        this.logger.error(
          `[${request.method}] ${request.url} → ${status}`,
          exception.stack,
        );
      }

      response.status(status).json(body);
      return;
    }

    // Express body-parser SyntaxError on malformed JSON payloads
    if (
      exception instanceof SyntaxError &&
      (('status' in exception && (exception as any).status === 400) ||
        'body' in exception)
    ) {
      this.logger.warn(`[SECURITY_MALFORMED_JSON] [${request.method}] ${request.url} from ${request.ip}`);
      const body: APIError = {
        success: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Malformed JSON payload in request body',
        },
      };
      response.status(HttpStatus.BAD_REQUEST).json(body);
      return;
    }

    // Zod validation errors (e.g. from manual Zod schema parsing in controllers)
    if (
      exception &&
      typeof exception === 'object' &&
      (('name' in exception && (exception as any).name === 'ZodError') ||
        'issues' in exception)
    ) {
      const issues = Array.isArray((exception as any).issues)
        ? (exception as any).issues
        : [];
      const validationDetails = issues.map(
        (issue: any) =>
          `${issue.path && issue.path.length > 0 ? issue.path.join('.') : 'field'}: ${issue.message}`,
      );
      const body: APIError = {
        success: false,
        error: {
          code: ErrorCode.VALIDATION_ERROR,
          message: 'Validation failed',
          details: { validation: validationDetails },
        },
      };
      response.status(HttpStatus.BAD_REQUEST).json(body);
      return;
    }

    // Prisma error handling
    if (exception && typeof exception === 'object' && 'code' in exception) {
      const prismaCode = (exception as any).code;
      if (typeof prismaCode === 'string' && prismaCode.startsWith('P')) {
        let status = HttpStatus.BAD_REQUEST;
        let message = 'Database error';
        
        if (prismaCode === 'P2002') {
          status = HttpStatus.CONFLICT;
          message = 'Unique constraint failed';
        } else if (prismaCode === 'P2025') {
          status = HttpStatus.NOT_FOUND;
          message = 'Record not found';
        }

        const body: APIError = {
          success: false,
          error: {
            code: statusToErrorCode(status),
            message: message,
            details: { prismaCode: [prismaCode] }
          }
        };

        this.logger.warn(`[${request.method}] ${request.url} → Prisma ${prismaCode}`);
        response.status(status).json(body);
        return;
      }
    }

    // Unhandled / unexpected errors → 500
    this.logger.error(
      `[${request.method}] ${request.url} → 500 (unhandled)`,
      exception instanceof Error ? exception.stack : String(exception),
    );

    const internalError: APIError = {
      success: false,
      error: {
        code: ErrorCode.INTERNAL_ERROR,
        message: 'Internal server error',
      },
    };

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(internalError);
  }
}
