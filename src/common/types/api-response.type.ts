import { ErrorCode } from '../enums/error-codes.enum';

export interface PaginationMeta {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export interface APIResponse<T> {
  success: boolean;
  data: T | null;
  message: string;
  meta?: PaginationMeta;
}

export interface APIError {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, string[]>;
  };
}

export function successResponse<T>(data: T, message = 'OK', meta?: PaginationMeta): APIResponse<T> {
  return { success: true, data, message, ...(meta ? { meta } : {}) };
}

export function errorResponse(
  code: ErrorCode,
  message: string,
  details?: Record<string, string[]>,
): APIError {
  return { success: false, error: { code, message, ...(details ? { details } : {}) } };
}
