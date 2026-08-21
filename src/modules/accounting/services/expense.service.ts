import { Injectable, Logger } from '@nestjs/common';
import { PrismaReadService } from '../../../config/prisma-read.service';
import { PrismaService } from '../../../config/prisma.service';
import { JournalEngineService } from '../../../services/journal-engine/journal-engine.service';
import { BusinessRuleException } from '../../../common/exceptions/business-rule.exception';
import { ErrorCode } from '../../../common/enums/error-codes.enum';
import { UUID } from '../../../common/types/uuid.type';

export interface RecordExpenseDTO {
  expense_account_id: UUID;
  payment_account_id: UUID;
  amount: number;
  description: string;
  category?: string;
  cost_center_id?: UUID;
  created_by: UUID;
}

@Injectable()
export class ExpenseService {
  private readonly logger = new Logger(ExpenseService.name);

  constructor(
    private readonly prismaRead: PrismaReadService,
    private readonly prisma: PrismaService,
    private readonly journalEngine: JournalEngineService,
  ) {}

  /**
   * Record operational expense and post journal
   */
  async recordExpense(dto: RecordExpenseDTO) {
    return await this.prisma.$transaction(async (tx) => {
      const period = await tx.fiscalPeriod.findFirst({ where: { status: 'OPEN' } });
      if (!period) throw new BusinessRuleException('No open fiscal period found', ErrorCode.NOT_FOUND);

      const expenseAccount = await tx.chartOfAccount.findUnique({ where: { id: dto.expense_account_id } });
      const paymentAccount = await tx.chartOfAccount.findUnique({ where: { id: dto.payment_account_id } });

      if (!expenseAccount || !paymentAccount) {
        throw new BusinessRuleException('Expense or Payment account not found', ErrorCode.NOT_FOUND);
      }

      // Create manual journal entry: Debit Expense Account, Credit Payment Account (Kas/Bank)
      const je = await this.journalEngine.createManualEntry(
        'EXPENSE_PAYMENT',
        dto.expense_account_id,
        dto.description || `Expense: ${expenseAccount.account_name}`,
        new Date(),
        [
          {
            account_id: dto.expense_account_id,
            debit: dto.amount,
            credit: 0,
            cost_center_id: dto.cost_center_id,
            description: dto.description,
          },
          {
            account_id: dto.payment_account_id,
            debit: 0,
            credit: dto.amount,
            description: dto.description,
          },
        ],
        dto.created_by,
        tx,
      );

      return je;
    });
  }

  /**
   * Get operational expenses summary by account / category
   */
  async getExpenseSummary(periodId?: UUID) {
    const activePeriod = periodId
      ? await this.prismaRead.fiscalPeriod.findUnique({ where: { id: periodId } })
      : await this.prismaRead.fiscalPeriod.findFirst({ where: { status: 'OPEN' } });

    if (!activePeriod) return [];

    const result = await this.prismaRead.$queryRawUnsafe<any[]>(`
      SELECT 
        c.id as account_id,
        c.account_code,
        c.account_name,
        COALESCE(SUM(l.debit - l.credit), 0) as total_amount
      FROM chart_of_accounts c
      JOIN journal_entry_lines l ON c.id = l.account_id
      JOIN journal_entries j ON l.je_id = j.id
      WHERE j.period_id = $1::uuid AND j.status = 'POSTED'
        AND c.account_type IN ('EXPENSE', 'OTHER_EXPENSE')
      GROUP BY c.id, c.account_code, c.account_name
      ORDER BY total_amount DESC
    `, activePeriod.id);

    return result.map(r => ({
      account_id: r.account_id,
      account_code: r.account_code,
      account_name: r.account_name,
      total_amount: Number(r.total_amount),
    }));
  }
}
