import { Injectable, Logger } from '@nestjs/common';
import { PrismaReadService } from '../../../config/prisma-read.service';
import { PrismaService } from '../../../config/prisma.service';
import { JournalEngineService } from '../../../services/journal-engine/journal-engine.service';
import { BusinessRuleException } from '../../../common/exceptions/business-rule.exception';
import { ErrorCode } from '../../../common/enums/error-codes.enum';
import { UUID } from '../../../common/types/uuid.type';

@Injectable()
export class CashBankService {
  private readonly logger = new Logger(CashBankService.name);

  constructor(
    private readonly prismaRead: PrismaReadService,
    private readonly prisma: PrismaService,
    private readonly journalEngine: JournalEngineService,
  ) {}

  /**
   * Get all Cash & Bank accounts with running balances from General Ledger
   */
  async getCashPosition(asOfDate: Date = new Date()) {
    const cashAccounts = await this.prismaRead.chartOfAccount.findMany({
      where: {
        account_type: { in: ['ASSET'] },
        account_category: { in: ['CASH', 'CLEARING'] },
        is_header: false,
      },
      orderBy: { account_code: 'asc' },
    });

    const balances = await Promise.all(
      cashAccounts.map(async (acc) => {
        const result = await this.prismaRead.journalEntryLine.aggregate({
          where: {
            account_id: acc.id,
            journal_entry: {
              status: 'POSTED',
              entry_date: { lte: asOfDate },
            },
          },
          _sum: {
            debit: true,
            credit: true,
          },
        });

        const debit = Number(result._sum.debit || 0);
        const credit = Number(result._sum.credit || 0);
        const balance = acc.normal_balance === 'DEBIT' ? debit - credit : credit - debit;

        return {
          account_id: acc.id,
          account_code: acc.account_code,
          account_name: acc.account_name,
          account_category: acc.account_category,
          balance,
        };
      })
    );

    const totalCash = balances.reduce((sum, item) => sum + item.balance, 0);

    return {
      as_of_date: asOfDate,
      total_cash_balance: totalCash,
      accounts: balances,
    };
  }

  /**
   * Record manual Cash In (penerimaan kas/bank non-AR)
   */
  async recordCashIn(
    accountId: UUID,
    amount: number,
    description: string,
    userId: UUID,
  ) {
    return await this.prisma.$transaction(async (tx) => {
      const period = await tx.fiscalPeriod.findFirst({ where: { status: 'OPEN' } });
      if (!period) throw new BusinessRuleException('No open fiscal period found', ErrorCode.NOT_FOUND);

      const targetAccount = await tx.chartOfAccount.findUnique({ where: { id: accountId } });
      if (!targetAccount) throw new BusinessRuleException('Account not found', ErrorCode.NOT_FOUND);

      return await this.journalEngine.processEvent(
        {
          event_type: 'CASH_IN',
          reference_type: 'CASH_IN',
          reference_id: accountId,
          reference_number: `CASH-IN-${Date.now()}`,
          entry_date: new Date(),
          period_id: period.id,
          amount,
          created_by: userId,
          metadata: { description, target_account_code: targetAccount.account_code },
        },
        tx,
      );
    });
  }

  /**
   * Record manual Cash Out (pengeluaran kas/bank non-AP)
   */
  async recordCashOut(
    accountId: UUID,
    amount: number,
    description: string,
    userId: UUID,
  ) {
    return await this.prisma.$transaction(async (tx) => {
      const period = await tx.fiscalPeriod.findFirst({ where: { status: 'OPEN' } });
      if (!period) throw new BusinessRuleException('No open fiscal period found', ErrorCode.NOT_FOUND);

      const sourceAccount = await tx.chartOfAccount.findUnique({ where: { id: accountId } });
      if (!sourceAccount) throw new BusinessRuleException('Account not found', ErrorCode.NOT_FOUND);

      return await this.journalEngine.processEvent(
        {
          event_type: 'CASH_OUT',
          reference_type: 'CASH_OUT',
          reference_id: accountId,
          reference_number: `CASH-OUT-${Date.now()}`,
          entry_date: new Date(),
          period_id: period.id,
          amount,
          created_by: userId,
          metadata: { description, source_account_code: sourceAccount.account_code },
        },
        tx,
      );
    });
  }

  /**
   * Record Transfer between Cash/Bank accounts
   */
  async recordTransfer(
    fromAccountId: UUID,
    toAccountId: UUID,
    amount: number,
    description: string,
    userId: UUID,
  ) {
    return await this.prisma.$transaction(async (tx) => {
      const period = await tx.fiscalPeriod.findFirst({ where: { status: 'OPEN' } });
      if (!period) throw new BusinessRuleException('No open fiscal period found', ErrorCode.NOT_FOUND);

      const fromAccount = await tx.chartOfAccount.findUnique({ where: { id: fromAccountId } });
      const toAccount = await tx.chartOfAccount.findUnique({ where: { id: toAccountId } });

      if (!fromAccount || !toAccount) {
        throw new BusinessRuleException('Source or destination account not found', ErrorCode.NOT_FOUND);
      }

      // Transfer journal: Debit toAccount, Credit fromAccount
      return await this.journalEngine.createManualEntry(
        'INTER_ACCOUNT_TRANSFER',
        fromAccountId,
        description || `Transfer from ${fromAccount.account_name} to ${toAccount.account_name}`,
        new Date(),
        [
          { account_id: toAccountId, debit: amount, credit: 0 },
          { account_id: fromAccountId, debit: 0, credit: amount },
        ],
        userId,
        tx,
      );
    });
  }
}
