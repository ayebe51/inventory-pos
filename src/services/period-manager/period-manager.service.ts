/**
 * PeriodManager Service
 *
 * Manages fiscal period lifecycle: DRAFT → OPEN → CLOSED
 *
 * Business Rules enforced:
 *   BR-ACC-002: No transactions in a closed period (PERIOD_LOCKED)
 *   BR-ACC-007: Fiscal periods must be closed in sequential order
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { UUID } from '../../common/types/uuid.type';
import {
  BusinessRuleException,
} from '../../common/exceptions/business-rule.exception';
import { ErrorCode } from '../../common/enums/error-codes.enum';

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface CreateFiscalPeriodDTO {
  period_name: string;
  year: number;
  month: number;   // 1–12
  start_date: Date;
  end_date: Date;
}

export interface FiscalPeriod {
  id: string;
  period_name: string;
  year: number;
  month: number;
  start_date: Date;
  end_date: Date;
  status: 'DRAFT' | 'OPEN' | 'CLOSED';
  closed_by: string | null;
  closed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class PeriodManagerService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new fiscal period in DRAFT status.
   * Validates no overlap with existing periods and calendar ordering.
   */
  async createPeriod(data: CreateFiscalPeriodDTO): Promise<FiscalPeriod> {
    const { period_name, year, month, start_date, end_date } = data;

    // Validate month range
    if (month < 1 || month > 12) {
      throw new BusinessRuleException(
        `Month must be between 1 and 12, got ${month}`,
        ErrorCode.VALIDATION_ERROR,
      );
    }

    // Validate date range
    if (start_date >= end_date) {
      throw new BusinessRuleException(
        'start_date must be before end_date',
        ErrorCode.VALIDATION_ERROR,
      );
    }

    // Check for duplicate year/month (unique constraint)
    const existing = await this.prisma.fiscalPeriod.findUnique({
      where: { year_month: { year, month } },
    });
    if (existing) {
      throw new BusinessRuleException(
        `Fiscal period for ${year}-${String(month).padStart(2, '0')} already exists`,
        ErrorCode.CONFLICT,
      );
    }

    // Check for date overlap with any existing period
    const overlapping = await this.prisma.fiscalPeriod.findFirst({
      where: {
        OR: [
          // new period starts inside an existing period
          { start_date: { lte: start_date }, end_date: { gte: start_date } },
          // new period ends inside an existing period
          { start_date: { lte: end_date }, end_date: { gte: end_date } },
          // new period completely contains an existing period
          { start_date: { gte: start_date }, end_date: { lte: end_date } },
        ],
      },
    });
    if (overlapping) {
      throw new BusinessRuleException(
        `Date range overlaps with existing period '${overlapping.period_name}'`,
        ErrorCode.CONFLICT,
      );
    }

    const period = await this.prisma.fiscalPeriod.create({
      data: {
        period_name,
        year,
        month,
        start_date,
        end_date,
        status: 'DRAFT',
      },
    });

    return period as FiscalPeriod;
  }

  /**
   * Transition a period from DRAFT → OPEN.
   * Only one period may be OPEN at a time.
   */
  async openPeriod(periodId: UUID): Promise<FiscalPeriod> {
    const period = await this.findPeriodOrThrow(periodId);

    if (period.status !== 'DRAFT') {
      throw new BusinessRuleException(
        `Cannot open period '${period.period_name}': current status is ${period.status}. Only DRAFT periods can be opened.`,
        ErrorCode.BUSINESS_RULE_VIOLATION,
      );
    }

    // Only one OPEN period at a time
    const openPeriod = await this.prisma.fiscalPeriod.findFirst({
      where: { status: 'OPEN' },
    });
    if (openPeriod) {
      throw new BusinessRuleException(
        `Cannot open period '${period.period_name}': period '${openPeriod.period_name}' is already OPEN. Close it first.`,
        ErrorCode.BUSINESS_RULE_VIOLATION,
      );
    }

    const updated = await this.prisma.fiscalPeriod.update({
      where: { id: periodId },
      data: { status: 'OPEN' },
    });

    return updated as FiscalPeriod;
  }

  /**
   * Transition a period from OPEN → CLOSED.
   *
   * Enforces BR-ACC-007: all earlier periods (by year/month) must already be CLOSED.
   * Also runs a basic checklist (bank reconciliation check per BR-ACC-008).
   */
  async closePeriod(periodId: UUID, userId: UUID): Promise<FiscalPeriod> {
    const period = await this.findPeriodOrThrow(periodId);

    if (period.status !== 'OPEN') {
      throw new BusinessRuleException(
        `Cannot close period '${period.period_name}': current status is ${period.status}. Only OPEN periods can be closed.`,
        ErrorCode.BUSINESS_RULE_VIOLATION,
      );
    }

    // BR-ACC-007: All earlier periods must be CLOSED
    const earlierUnclosed = await this.prisma.fiscalPeriod.findFirst({
      where: {
        status: { not: 'CLOSED' },
        OR: [
          { year: { lt: period.year } },
          { year: period.year, month: { lt: period.month } },
        ],
      },
      orderBy: [{ year: 'asc' }, { month: 'asc' }],
    });

    if (earlierUnclosed) {
      throw new BusinessRuleException(
        `BR-ACC-007: Cannot close period '${period.period_name}'. ` +
          `Earlier period '${earlierUnclosed.period_name}' (${earlierUnclosed.year}-${String(earlierUnclosed.month).padStart(2, '0')}) ` +
          `must be closed first.`,
        ErrorCode.BUSINESS_RULE_VIOLATION,
      );
    }

    // BR-ACC-008: Bank reconciliation must be complete
    const incompleteRecon = await this.prisma.bankReconciliation.findFirst({
      where: {
        period_id: periodId,
        status: { not: 'COMPLETED' },
      },
    });

    if (incompleteRecon) {
      throw new BusinessRuleException(
        `BR-ACC-008: Cannot close period '${period.period_name}'. Bank reconciliation is not complete.`,
        ErrorCode.BUSINESS_RULE_VIOLATION,
      );
    }

    const updated = await this.prisma.fiscalPeriod.update({
      where: { id: periodId },
      data: {
        status: 'CLOSED',
        closed_by: userId,
        closed_at: new Date(),
      },
    });

    return updated as FiscalPeriod;
  }

  /**
   * Get the currently OPEN fiscal period.
   * branchId is accepted for API compatibility but fiscal periods are global in this schema.
   */
  async getCurrentPeriod(_branchId?: UUID): Promise<FiscalPeriod> {
    const period = await this.prisma.fiscalPeriod.findFirst({
      where: { status: 'OPEN' },
    });

    if (!period) {
      throw new BusinessRuleException(
        'No fiscal period is currently OPEN',
        ErrorCode.NOT_FOUND,
      );
    }

    return period as FiscalPeriod;
  }

  /**
   * Find which fiscal period a given date falls into.
   */
  async getPeriodForDate(date: Date, _branchId?: UUID): Promise<FiscalPeriod> {
    const period = await this.prisma.fiscalPeriod.findFirst({
      where: {
        start_date: { lte: date },
        end_date: { gte: date },
      },
    });

    if (!period) {
      throw new BusinessRuleException(
        `No fiscal period found for date ${date.toISOString().slice(0, 10)}`,
        ErrorCode.NOT_FOUND,
      );
    }

    return period as FiscalPeriod;
  }

  /**
   * Validate that a period is OPEN. Throws PERIOD_LOCKED if it is CLOSED.
   * Used by other services before posting transactions (BR-ACC-002).
   */
  async validatePeriodOpen(periodId: UUID): Promise<void> {
    const period = await this.findPeriodOrThrow(periodId);

    if (period.status === 'CLOSED') {
      throw new BusinessRuleException(
        `BR-ACC-002: Transaksi tidak dapat diposting ke period yang sudah ditutup (${period.period_name})`,
        ErrorCode.PERIOD_LOCKED,
      );
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async findPeriodOrThrow(periodId: UUID) {
    const period = await this.prisma.fiscalPeriod.findUnique({
      where: { id: periodId },
    });

    if (!period) {
      throw new BusinessRuleException(
        `Fiscal period ${periodId} not found`,
        ErrorCode.NOT_FOUND,
      );
    }

    return period;
  }
}
