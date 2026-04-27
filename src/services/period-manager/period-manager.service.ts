/**
 * PeriodManager Service
 *
 * Manages fiscal period lifecycle: DRAFT → OPEN → CLOSED
 *
 * Business Rules enforced:
 *   BR-ACC-002: No transactions in a closed period (PERIOD_LOCKED)
 *   BR-ACC-007: Fiscal periods must be closed in sequential order
 *   BR-ACC-008: Bank reconciliation must be complete before period closing
 *
 * Period Closing Checklist (Req 8, AC 9-11):
 *   1. No open invoices (OPEN, PARTIAL, OVERDUE)
 *   2. No pending payments (DRAFT, PENDING_APPROVAL, APPROVED)
 *   3. No unbalanced journal entries (|debit - credit| > 0.01)
 *   4. All bank reconciliations completed
 *   5. No incomplete stock opnames (INITIATED, IN_PROGRESS)
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

export interface ChecklistItemResult {
  passed: boolean;
  message: string;
  count?: number;
}

export interface PeriodClosingChecklistResult {
  canClose: boolean;
  items: {
    noOpenInvoices: ChecklistItemResult;
    noPendingPayments: ChecklistItemResult;
    noUnbalancedJournals: ChecklistItemResult;
    bankReconciliationComplete: ChecklistItemResult;
    noIncompleteOpnames: ChecklistItemResult;
  };
  failedItems: string[];
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

// Statuses that indicate an invoice is not yet settled
const OPEN_INVOICE_STATUSES = ['OPEN', 'PARTIAL', 'OVERDUE'];

// Statuses that indicate a payment has not yet been posted
const PENDING_PAYMENT_STATUSES = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'];

// Statuses that indicate a stock opname is still in progress
const INCOMPLETE_OPNAME_STATUSES = ['INITIATED', 'IN_PROGRESS'];

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
   * Runs the full closing checklist (Req 8, AC 9-11) — rejects if any item fails.
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

    // Run the full closing checklist
    const checklist = await this.validatePeriodClosingChecklist(periodId);

    if (!checklist.canClose) {
      throw new BusinessRuleException(
        `Cannot close period '${period.period_name}': the following checklist items are incomplete: ${checklist.failedItems.join(', ')}`,
        ErrorCode.BUSINESS_RULE_VIOLATION,
        { checklistFailures: checklist.failedItems },
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
   * Validate the period closing checklist.
   *
   * Checks (Req 8, AC 9):
   *   1. No open invoices (OPEN, PARTIAL, OVERDUE) within the period's date range
   *   2. No pending payments (DRAFT, PENDING_APPROVAL, APPROVED) within the period's date range
   *   3. All journal entries in the period are balanced (|debit - credit| <= 0.01) — BR-ACC-001
   *   4. All bank reconciliations for the period are COMPLETED — BR-ACC-008
   *   5. No stock opnames in INITIATED or IN_PROGRESS status for warehouses in the period's branch scope
   *
   * Returns a structured result with each item's pass/fail status and a summary.
   */
  async validatePeriodClosingChecklist(periodId: UUID): Promise<PeriodClosingChecklistResult> {
    const period = await this.findPeriodOrThrow(periodId);

    // ── 1. No open invoices ──────────────────────────────────────────────────
    const openInvoiceCount = await this.prisma.invoice.count({
      where: {
        status: { in: OPEN_INVOICE_STATUSES },
        invoice_date: {
          gte: period.start_date,
          lte: period.end_date,
        },
      },
    });

    const noOpenInvoices: ChecklistItemResult = {
      passed: openInvoiceCount === 0,
      message: openInvoiceCount === 0
        ? 'No open invoices'
        : `${openInvoiceCount} open invoice(s) with status OPEN/PARTIAL/OVERDUE`,
      count: openInvoiceCount,
    };

    // ── 2. No pending payments ───────────────────────────────────────────────
    const pendingPaymentCount = await this.prisma.payment.count({
      where: {
        status: { in: PENDING_PAYMENT_STATUSES },
        payment_date: {
          gte: period.start_date,
          lte: period.end_date,
        },
      },
    });

    const noPendingPayments: ChecklistItemResult = {
      passed: pendingPaymentCount === 0,
      message: pendingPaymentCount === 0
        ? 'No pending payments'
        : `${pendingPaymentCount} pending payment(s) with status DRAFT/PENDING_APPROVAL/APPROVED`,
      count: pendingPaymentCount,
    };

    // ── 3. No unbalanced journal entries (BR-ACC-001) ────────────────────────
    // Fetch all journal entries for the period and check balance in application layer
    // (Prisma does not support ABS() or computed WHERE clauses natively)
    const journalEntries = await this.prisma.journalEntry.findMany({
      where: { period_id: periodId },
      select: { id: true, je_number: true, total_debit: true, total_credit: true },
    });

    const unbalancedEntries = journalEntries.filter((je) => {
      const diff = Math.abs(Number(je.total_debit) - Number(je.total_credit));
      return diff > 0.01;
    });

    const noUnbalancedJournals: ChecklistItemResult = {
      passed: unbalancedEntries.length === 0,
      message: unbalancedEntries.length === 0
        ? 'All journal entries are balanced'
        : `${unbalancedEntries.length} unbalanced journal entry/entries (|debit - credit| > 0.01)`,
      count: unbalancedEntries.length,
    };

    // ── 4. Bank reconciliation complete (BR-ACC-008) ─────────────────────────
    const incompleteReconCount = await this.prisma.bankReconciliation.count({
      where: {
        period_id: periodId,
        status: { not: 'COMPLETED' },
      },
    });

    const bankReconciliationComplete: ChecklistItemResult = {
      passed: incompleteReconCount === 0,
      message: incompleteReconCount === 0
        ? 'All bank reconciliations are completed'
        : `${incompleteReconCount} incomplete bank reconciliation(s)`,
      count: incompleteReconCount,
    };

    // ── 5. No incomplete stock opnames ───────────────────────────────────────
    // Scope: warehouses belonging to branches that have invoices/journals in this period.
    // Since FiscalPeriod is global (no branch_id), we check all warehouses system-wide.
    const incompleteOpnameCount = await this.prisma.stockOpname.count({
      where: {
        status: { in: INCOMPLETE_OPNAME_STATUSES },
      },
    });

    const noIncompleteOpnames: ChecklistItemResult = {
      passed: incompleteOpnameCount === 0,
      message: incompleteOpnameCount === 0
        ? 'No incomplete stock opnames'
        : `${incompleteOpnameCount} incomplete stock opname(s) in INITIATED/IN_PROGRESS status`,
      count: incompleteOpnameCount,
    };

    // ── Aggregate result ─────────────────────────────────────────────────────
    const items = {
      noOpenInvoices,
      noPendingPayments,
      noUnbalancedJournals,
      bankReconciliationComplete,
      noIncompleteOpnames,
    };

    const failedItems = Object.entries(items)
      .filter(([, v]) => !v.passed)
      .map(([, v]) => v.message);

    return {
      canClose: failedItems.length === 0,
      items,
      failedItems,
    };
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
