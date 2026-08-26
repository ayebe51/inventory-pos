import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma.service';
import { NumberingService, DocumentType } from '../../../services/numbering/numbering.service';
import { PeriodManagerService } from '../../../services/period-manager/period-manager.service';
import { JournalEngineService } from '../../../services/journal-engine/journal-engine.service';
import { BusinessRuleException } from '../../../common/exceptions/business-rule.exception';
import { ErrorCode } from '../../../common/enums/error-codes.enum';
import { assertOptionalUuid } from '../../../common/utils/uuid.util';
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
          reference_type: data.reference_type || '',
          reference_id: data.reference_id || '00000000-0000-0000-0000-000000000000',
          reference_number: data.reference_number || '',
          description: data.description || '',
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

      return reversalJe as any;
    });
  }

  async getRecentJournalEntries(limit: number = 10): Promise<JournalEntry[]> {
    const entries = await this.prisma.journalEntry.findMany({
      take: limit,
      orderBy: { created_at: 'desc' },
      include: { lines: true }
    });
    return entries as any;
  }

  async getTrialBalance(periodId: UUID, branchId?: UUID): Promise<TrialBalance> {
    const safeBranchId = assertOptionalUuid(branchId, 'branch_id');
    const result = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT
        c.id as account_id,
        c.account_code,
        c.account_name,
        c.account_type,
        SUM(l.debit) as debit_balance,
        SUM(l.credit) as credit_balance
      FROM chart_of_accounts c
      JOIN journal_entry_lines l ON c.id = l.account_id
      JOIN journal_entries j ON l.je_id = j.id
      WHERE j.period_id = $1::uuid AND j.status = 'POSTED'
      ${safeBranchId ? `AND c.branch_id = $2::uuid` : ''}
      GROUP BY c.id, c.account_code, c.account_name, c.account_type
      ORDER BY c.account_code ASC
    `, periodId, ...(safeBranchId ? [safeBranchId] : []));

    let total_debit = 0;
    let total_credit = 0;
    
    const accounts = result.map(r => {
      const debit = Number(r.debit_balance || 0);
      const credit = Number(r.credit_balance || 0);
      total_debit += debit;
      total_credit += credit;
      
      return {
        account_id: r.account_id,
        account_code: r.account_code,
        account_name: r.account_name,
        account_type: r.account_type,
        debit_balance: debit,
        credit_balance: credit,
      };
    });

    return {
      period_id: periodId,
      accounts,
      total_debit,
      total_credit,
      generated_at: new Date()
    };
  }

  async closePeriod(periodId: UUID, userId: UUID): Promise<FiscalPeriod> {
    return await this.prisma.$transaction(async (tx) => {
      const period = await tx.fiscalPeriod.findUnique({ where: { id: periodId } });
      if (!period) throw new BusinessRuleException('Period not found', ErrorCode.NOT_FOUND);
      
      const result = await tx.$queryRawUnsafe<any[]>(`
        SELECT 
          c.id as account_id,
          c.account_type,
          c.normal_balance,
          COALESCE(SUM(l.debit), 0) as total_debit,
          COALESCE(SUM(l.credit), 0) as total_credit
        FROM chart_of_accounts c
        JOIN journal_entry_lines l ON c.id = l.account_id
        JOIN journal_entries j ON l.je_id = j.id
        WHERE j.period_id = $1::uuid AND j.status = 'POSTED'
          AND c.account_type IN ('REVENUE', 'EXPENSE', 'COGS')
        GROUP BY c.id, c.account_type, c.normal_balance
      `, periodId);

      if (result.length > 0) {
        const retainedEarningsAcct = await tx.chartOfAccount.findFirst({
          where: { account_type: 'EQUITY', account_code: { startsWith: '3' } } 
        });

        if (retainedEarningsAcct) {
          const closingLines: { account_id: string; description: string; debit: number; credit: number }[] = [];
          let netIncome = 0;

          for (const row of result) {
            const debit = Number(row.total_debit);
            const credit = Number(row.total_credit);
            const balance = row.normal_balance === 'DEBIT' ? debit - credit : credit - debit;
            
            if (balance !== 0) {
               if (row.normal_balance === 'DEBIT') {
                 closingLines.push({
                   account_id: row.account_id,
                   description: 'Closing Entry',
                   debit: 0,
                   credit: balance
                 });
                 netIncome -= balance;
               } else {
                 closingLines.push({
                   account_id: row.account_id,
                   description: 'Closing Entry',
                   debit: balance,
                   credit: 0
                 });
                 netIncome += balance;
               }
            }
          }

          if (netIncome !== 0) {
            closingLines.push({
              account_id: retainedEarningsAcct.id,
              description: 'Period Net Income to Retained Earnings',
              debit: netIncome < 0 ? Math.abs(netIncome) : 0,
              credit: netIncome > 0 ? netIncome : 0
            });

            const jeNumber = await this.numberingService.generate(DocumentType.JE);
            const totalDebit = closingLines.reduce((sum, l) => sum + Number(l.debit), 0);
            const totalCredit = closingLines.reduce((sum, l) => sum + Number(l.credit), 0);

            await tx.journalEntry.create({
              data: {
                je_number: jeNumber,
                entry_date: period.end_date,
                period_id: periodId,
                reference_type: 'PERIOD_CLOSING',
                reference_id: periodId,
                reference_number: jeNumber,
                description: 'Period Closing Entries',
                total_debit: totalDebit,
                total_credit: totalCredit,
                status: 'POSTED',
                is_auto_generated: true,
                created_by: userId,
                posted_by: userId,
                posted_at: new Date(),
                lines: {
                  create: closingLines.map((l, index) => ({
                    line_number: index + 1,
                    account_id: l.account_id,
                    description: l.description,
                    debit: l.debit,
                    credit: l.credit,
                  }))
                }
              }
            });
          }
        }
      }

      // Finally close the period via PeriodManagerService
      // But periodManager uses its own Prisma instance by default. Since we are in tx,
      // we can't pass tx to periodManager. Let's just update it directly to keep transaction safe.
      const closedPeriod = await tx.fiscalPeriod.update({
        where: { id: periodId },
        data: {
          status: 'CLOSED',
          closed_by: userId,
          closed_at: new Date(),
        }
      });

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
