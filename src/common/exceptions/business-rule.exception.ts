import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../enums/error-codes.enum';

export class BusinessRuleException extends HttpException {
  constructor(
    message: string,
    code: ErrorCode = ErrorCode.BUSINESS_RULE_VIOLATION,
    details?: Record<string, string[]>,
  ) {
    super(
      {
        success: false,
        error: {
          code,
          message,
          ...(details ? { details } : {}),
        },
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

export class PeriodLockedException extends BusinessRuleException {
  constructor(period?: string) {
    super(
      period ? `Fiscal period '${period}' is locked` : 'Fiscal period is locked',
      ErrorCode.PERIOD_LOCKED,
    );
  }
}

export class InsufficientStockException extends BusinessRuleException {
  constructor(productId?: string, warehouseId?: string) {
    super(
      productId && warehouseId
        ? `Insufficient stock for product ${productId} in warehouse ${warehouseId}`
        : 'Insufficient stock',
      ErrorCode.INSUFFICIENT_STOCK,
    );
  }
}

export class ApprovalRequiredException extends BusinessRuleException {
  constructor(message = 'This action requires approval') {
    super(message, ErrorCode.APPROVAL_REQUIRED);
  }
}
