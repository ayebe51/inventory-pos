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

    return {
      success: false,
      error: {
        code,
        message: isValidationArray
          ? 'Validation failed'
          : String(msg),
        ...(details ? { details } : {}),
      },
    };
  }

  // Plain string response
  return {
    success: false,
    error: {
      code: statusToErrorCode(fallbackStatus),
      message: typeof response === 'string' ? response : 'An error occurred',
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

      if (status >= 500) {
        this.logger.error(
          `[${request.method}] ${request.url} → ${status}`,
          exception.stack,
        );
      }

      response.status(status).json(body);
      return;
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
