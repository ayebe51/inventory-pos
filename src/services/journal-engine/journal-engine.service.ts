import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../config/prisma.service';
import { NumberingService, DocumentType } from '../numbering/numbering.service';
import { PeriodManagerService } from '../period-manager/period-manager.service';
import { BusinessRuleException } from '../../common/exceptions/business-rule.exception';
import { ErrorCode } from '../../common/enums/error-codes.enum';
import {
  AutoJournalEngine,
  BusinessEvent,
  JournalBalanceValidationResult,
  JournalEntry,
  JournalLine,
  JournalTemplate,
  JournalEventType,
} from '../../modules/accounting/interfaces/accounting.interfaces';

@Injectable()
export class JournalEngineService implements AutoJournalEngine {
  constructor(
    private readonly prisma: PrismaService,
    private readonly numbering: NumberingService,
    private readonly periodManager: PeriodManagerService,
  ) {}

  /**
   * Process a business event and create the corresponding auto journal entry.
   *
   * @param event - The business event to journal
   * @param tx    - Optional Prisma transaction client. When provided, the journal
   *               write participates in the caller's existing transaction so that
   *               the business operation and the journal are committed/rolled back
   *               atomically. When omitted, a new internal transaction is started.
   */
  async processEvent(event: BusinessEvent, tx?: Prisma.TransactionClient): Promise<JournalEntry[]> {
    // Use the provided tx client or fall back to the global prisma instance
    const client = tx ?? this.prisma;

    // 1. Validate fiscal period is OPEN (BR-ACC-002)
    await this.periodManager.validatePeriodOpen(event.period_id);

    // 2. Fetch the auto journal template
    const template = await client.autoJournalTemplate.findUnique({
      where: { event_type: event.event_type },
    });

    if (!template || !template.is_active) {
      throw new BusinessRuleException(
        `Journal template not found for event type: ${event.event_type}`,
        ErrorCode.NOT_FOUND,
      );
    }

    // 3. Build journal lines
    let lines: JournalLine[];

    if (event.lines && event.lines.length > 0) {
      // Multi-line events (SALES_INVOICE, POS_SALE, PERIOD_CLOSING_*, etc.)
      lines = event.lines;
    } else {
      // Simple single-amount event: build two lines from template
      lines = [
        {
          account_id: template.debit_account_id,
          debit: event.amount,
          credit: 0,
        },
        {
          account_id: template.credit_account_id,
          debit: 0,
          credit: event.amount,
        },
      ];
    }

    // 4. Validate balance (BR-ACC-001)
    if (!this.validateBalance(lines)) {
      const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
      const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
      const diff = Math.abs(totalDebit - totalCredit);
      throw new BusinessRuleException(
        `BR-ACC-001: Journal entry is not balanced. Debit=${totalDebit} Credit=${totalCredit} Difference=${diff}`,
        ErrorCode.BUSINESS_RULE_VIOLATION,
      );
    }

    // 5. Generate JE number
    const jeNumber = await this.numbering.generate(DocumentType.JE, event.entry_date);

    // 6. Compute totals
    const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
    const now = new Date();

    // 7. Create JournalEntry + lines.
    //    If a tx client was provided we write directly into it (caller owns the
    //    transaction boundary). Otherwise we open our own internal transaction.
    const writeJe = async (writeClient: Prisma.TransactionClient) => {
      return writeClient.journalEntry.create({
        data: {
          je_number: jeNumber,
          entry_date: event.entry_date,
          period_id: event.period_id,
          reference_type: event.reference_type,
          reference_id: event.reference_id,
          reference_number: event.reference_number,
          description: `Auto journal: ${event.event_type} - ${event.reference_number}`,
          total_debit: totalDebit,
          total_credit: totalCredit,
          status: 'POSTED',
          is_auto_generated: true,
          posted_by: event.created_by,
          posted_at: now,
          created_by: event.created_by,
          lines: {
            create: lines.map((line, index) => ({
              line_number: index + 1,
              account_id: line.account_id,
              cost_center_id: line.cost_center_id ?? null,
              description: line.description ?? null,
              debit: line.debit,
              credit: line.credit,
            })),
          },
        },
        include: { lines: true },
      });
    };

    const created = tx
      ? await writeJe(tx)
      : await this.prisma.$transaction((innerTx) => writeJe(innerTx));

    // Map Prisma result to JournalEntry interface
    const result: JournalEntry = {
      id: created.id,
      je_number: created.je_number,
      entry_date: created.entry_date,
      period_id: created.period_id,
      reference_type: created.reference_type,
      reference_id: created.reference_id,
      reference_number: created.reference_number,
      description: created.description,
      total_debit: Number(created.total_debit),
      total_credit: Number(created.total_credit),
      status: created.status as JournalEntry['status'],
      is_auto_generated: created.is_auto_generated,
      reversed_by: created.reversed_by ?? null,
      reversed_at: created.reversed_at ?? null,
      posted_by: created.posted_by ?? null,
      posted_at: created.posted_at ?? null,
      created_by: created.created_by,
      created_at: created.created_at,
      updated_at: created.updated_at,
    };

    return [result];
  }

  async getJournalTemplate(eventType: JournalEventType, tx?: Prisma.TransactionClient): Promise<JournalTemplate> {
    const client = tx ?? this.prisma;
    const template = await client.autoJournalTemplate.findUnique({
      where: { event_type: eventType },
      include: {
        debit_account: true,
        credit_account: true,
      },
    });

    if (!template) {
      throw new BusinessRuleException(
        `Journal template not found for event type: ${eventType}`,
        ErrorCode.NOT_FOUND,
      );
    }

    return {
      event_type: template.event_type as JournalEventType,
      debit_account_code: template.debit_account.account_code,
      credit_account_code: template.credit_account.account_code,
      description_template: template.description,
    };
  }

  validateBalance(lines: JournalLine[]): boolean {
    const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
    return Math.abs(totalDebit - totalCredit) <= 0.01;
  }

  /**
   * BR-ACC-001: |SUM(debit) - SUM(credit)| <= 0.01
   * Returns a detailed validation result with totals and difference.
   * Throws BusinessRuleException if lines are empty or any line has both debit and credit > 0.
   */
  validateJournalBalance(lines: JournalLine[]): JournalBalanceValidationResult {
    if (!lines || lines.length < 2) {
      throw new BusinessRuleException(
        'Journal entry must have at least 2 lines',
        ErrorCode.VALIDATION_ERROR,
      );
    }

    for (const line of lines) {
      if (line.debit < 0 || line.credit < 0) {
        throw new BusinessRuleException(
          'Journal line debit and credit must be >= 0',
          ErrorCode.VALIDATION_ERROR,
        );
      }
      if (line.debit > 0 && line.credit > 0) {
        throw new BusinessRuleException(
          'Journal line cannot have both debit and credit > 0',
          ErrorCode.VALIDATION_ERROR,
        );
      }
    }

    const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
    const difference = Math.abs(totalDebit - totalCredit);
    const isValid = difference <= 0.01;

    if (!isValid) {
      throw new BusinessRuleException(
        `BR-ACC-001: Journal tidak balance. Debit=${totalDebit} Credit=${totalCredit} Selisih=${difference}`,
        ErrorCode.BUSINESS_RULE_VIOLATION,
      );
    }

    return { isValid, totalDebit, totalCredit, difference };
  }
}
