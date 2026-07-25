import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma.service';
import { NumberingService, DocumentType } from '../../../services/numbering/numbering.service';
import { PeriodManagerService } from '../../../services/period-manager/period-manager.service';
import { JournalEngineService } from '../../../services/journal-engine/journal-engine.service';
import { BusinessRuleException } from '../../../common/exceptions/business-rule.exception';
import { ErrorCode } from '../../../common/enums/error-codes.enum';
import { UUID } from '../../../common/types/uuid.type';
import {
  AccountingService as IAccountingService,
  JournalEntryDTO,
  JournalEntry,
  TrialBalance,
  TrialBalanceAccount,
  AccountBalance,
  FiscalPeriod,
} from '../interfaces/accounting.interfaces';

@Injectable()
export class AccountingService implements IAccountingService {
  private readonly logger = new Logger(AccountingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly numberingService: NumberingService,
    private readonly periodManager: PeriodManagerService,
    private readonly journalEngine: JournalEngineService,
  ) {}

  async postJournalEntry(data: JournalEntryDTO): Promise<JournalEntry> {
    return await this.prisma.$transaction(async (tx) => {
      // Validate period is open
      await this.periodManager.validatePeriodOpen(data.period_id);

      // Validate balance
      this.journalEngine.validateJournalBalance(data.lines);

      const jeNumber = await this.numberingService.generate(DocumentType.JE);
      const totalDebit = data.lines.reduce((s, l) => s + Number(l.debit), 0);
      const totalCredit = data.lines.reduce((s, l) => s + Number(l.credit), 0);

      const je = await tx.journalEntry.create({
        data: {
          je_number: jeNumber,
          entry_date: data.entry_date,
          period_id: data.period_id,
          reference_type: data.reference_type,
          reference_id: data.reference_id,
          reference_number: data.reference_number,
          description: data.description,
          total_debit: totalDebit,
          total_credit: totalCredit,
          status: 'POSTED',
          is_auto_generated: data.is_auto_generated || false,
          created_by: data.created_by,
          posted_by: data.created_by,
          posted_at: new Date(),
          lines: {
            create: data.lines.map((l, index) => ({
              line_number: index + 1,
              account_id: l.account_id,
              cost_center_id: l.cost_center_id,
              description: l.description,
              debit: l.debit,
              credit: l.credit,
            }))
          }
        },
        include: { lines: true }
      });

      return je as any;
    });
  }

  async reverseJournalEntry(id: UUID, userId: UUID, reason: string): Promise<JournalEntry> {
    return await this.prisma.$transaction(async (tx) => {
      const je = await tx.journalEntry.findUnique({ 
        where: { id },
        include: { lines: true } 
      });
      if (!je) throw new BusinessRuleException('Journal Entry not found', ErrorCode.NOT_FOUND);
      
      if (je.status !== 'POSTED') {
        throw new BusinessRuleException('Only POSTED journal entries can be reversed', ErrorCode.VALIDATION_ERROR);
      }

      await this.periodManager.validatePeriodOpen(je.period_id);

      // Create Reversal JE
      const jeNumber = await this.numberingService.generate(DocumentType.JE);
      
      // Reverse lines (swap debit/credit)
      const reversalLines = je.lines.map((l, index) => ({
        line_number: index + 1,
        account_id: l.account_id,
        cost_center_id: l.cost_center_id,
        description: `Reversal of ${je.je_number}`,
        debit: l.credit,
        credit: l.debit,
      }));

      const reversalJe = await tx.journalEntry.create({
        data: {
          je_number: jeNumber,
          entry_date: new Date(),
          period_id: je.period_id,
          reference_type: 'JE_REVERSAL',
          reference_id: je.id,
          reference_number: je.je_number,
          description: `Reversal of ${je.je_number}: ${reason}`,
          total_debit: je.total_debit,
          total_credit: je.total_credit,
          status: 'POSTED',
          is_auto_generated: true,
          created_by: userId,
          posted_by: userId,
          posted_at: new Date(),
          lines: {
            create: reversalLines
          }
        }
      });

      // Mark original as reversed
      const updated = await tx.journalEntry.update({
        where: { id },
        data: {
          status: 'REVERSED',
          reversed_by: userId,
          reversed_at: new Date(),
        }
      });

      return updated as any;
    });
  }

  async getTrialBalance(periodId: UUID, branchId?: UUID): Promise<TrialBalance> {
    // In a real implementation, this would aggregate journal entry lines or account balances
    // For now, this is a simplified stub returning empty trial balance
    return {
      period_id: periodId,
      accounts: [],
      total_debit: 0,
      total_credit: 0,
      generated_at: new Date()
    };
  }

  async closePeriod(periodId: UUID, userId: UUID): Promise<FiscalPeriod> {
    return await this.prisma.$transaction(async (tx) => {
      // The PeriodManagerService handles checklist validation and status update
      const closedPeriod = await this.periodManager.closePeriod(periodId, userId);

      // End of Period Closing routine:
      // Transfer REVENUE and EXPENSE balances to RETAINED EARNINGS.
      // In a full implementation, we would query the total net income,
      // and generate a PERIOD_CLOSING_NET journal entry here.
      // This is simplified to just calling the journal engine.
      
      const retainedEarningsAcct = await tx.chartOfAccount.findFirst({
        where: { account_code: '31000' } // Example standard code
      });

      if (retainedEarningsAcct) {
        // Auto-journal for net income transfer would go here
        // await this.journalEngine.processEvent(...)
      }

      return closedPeriod as any;
    });
  }

  async getAccountBalance(accountId: UUID, asOfDate: Date): Promise<AccountBalance> {
    // Sum all journal entry lines up to asOfDate
    const account = await this.prisma.chartOfAccount.findUnique({ where: { id: accountId } });
    if (!account) throw new BusinessRuleException('Account not found', ErrorCode.NOT_FOUND);

    const result = await this.prisma.journalEntryLine.aggregate({
      where: {
        account_id: accountId,
        journal_entry: {
          status: 'POSTED',
          entry_date: { lte: asOfDate }
        }
      },
      _sum: {
        debit: true,
        credit: true
      }
    });

    const sumDebit = Number(result._sum.debit || 0);
    const sumCredit = Number(result._sum.credit || 0);
    const balance = account.normal_balance === 'DEBIT' 
      ? sumDebit - sumCredit 
      : sumCredit - sumDebit;

    return {
      account_id: accountId,
      account_code: account.account_code,
      account_name: account.account_name,
      balance,
      normal_balance: account.normal_balance as any,
      as_of_date: asOfDate
    };
  }
}
