import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma.service';
import { BusinessRuleException } from '../../../common/exceptions/business-rule.exception';
import { ErrorCode } from '../../../common/enums/error-codes.enum';
import { UUID } from '../../../common/types/uuid.type';
import {
  BankReconciliationService as IBankReconciliationService,
  BankStatementDTO,
  BankStatement,
  ReconciliationResult,
  OutstandingItems,
} from '../interfaces/invoicing.interfaces';

@Injectable()
export class BankReconciliationService implements IBankReconciliationService {
  private readonly logger = new Logger(BankReconciliationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async importBankStatement(data: BankStatementDTO): Promise<BankStatement> {
    return await this.prisma.$transaction(async (tx) => {
      // Validate bank account
      const bankAccount = await tx.chartOfAccount.findUnique({
        where: { id: data.bank_account_id }
      });
      if (!bankAccount) {
        throw new BusinessRuleException('Bank account not found', ErrorCode.NOT_FOUND);
      }

      // Create lines
      for (const line of data.lines) {
        await tx.bankStatement.create({
          data: {
            bank_account_id: data.bank_account_id,
            statement_date: line.transaction_date,
            reference_number: line.reference || `${Date.now()}`,
            description: line.description,
            amount: line.amount,
            transaction_type: line.type,
            is_matched: false,
          }
        });
      }

      // Dummy return for batch since Prisma schema only stores lines
      const summary: BankStatement = {
        id: data.bank_account_id, // Dummy UUID
        bank_account_id: data.bank_account_id,
        statement_date: data.statement_date,
        opening_balance: data.opening_balance,
        closing_balance: data.closing_balance,
        imported_at: new Date(),
        imported_by: data.bank_account_id, // Dummy user ID (as we don't have it in DTO)
      };

      return summary;
    });
  }

  async autoMatch(bankAccountId: UUID): Promise<ReconciliationResult> {
    return await this.prisma.$transaction(async (tx) => {
      // 1. Fetch unmatched statement lines
      const unmatchedStatements = await tx.bankStatement.findMany({
        where: {
          bank_account_id: bankAccountId,
          is_matched: false,
        }
      });

      // 2. Fetch posted but unreconciled payments
      const unreconciledPayments = await tx.payment.findMany({
        where: {
          status: 'POSTED',
          payment_method: {
            // Assume we can get payments linked to this bank account somehow.
            // Simplified: we check if payment amount matches any statement.
          }
        }
      });

      let matched = 0;
      let total_matched_amount = 0;

      for (const stmt of unmatchedStatements) {
        // Find exact match: amount + date (+- 1 day maybe?)
        const stmtDate = new Date(stmt.statement_date).getTime();
        const match = unreconciledPayments.find(p => 
          Number(p.amount) === Number(stmt.amount) &&
          p.status === 'POSTED' &&
          Math.abs(new Date(p.payment_date).getTime() - stmtDate) <= 86400000 // 1 day tolerance
        );

        if (match) {
          // Update statement
          await tx.bankStatement.update({
            where: { id: stmt.id },
            data: {
              is_matched: true,
              matched_payment_id: match.id,
              matched_at: new Date()
            }
          });

          // Update payment status
          await tx.payment.update({
            where: { id: match.id },
            data: {
              status: 'RECONCILED'
            }
          });

          match.status = 'RECONCILED'; // Prevent re-matching
          matched++;
          total_matched_amount += Number(stmt.amount);
        }
      }

      const unmatched = unmatchedStatements.length - matched;

      return {
        matched,
        unmatched,
        total_matched_amount
      };
    });
  }

  async manualMatch(statementLineId: UUID, paymentId: UUID): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const stmt = await tx.bankStatement.findUnique({ where: { id: statementLineId } });
      if (!stmt) throw new BusinessRuleException('Statement line not found', ErrorCode.NOT_FOUND);
      if (stmt.is_matched) throw new BusinessRuleException('Statement already matched', ErrorCode.VALIDATION_ERROR);

      const payment = await tx.payment.findUnique({ where: { id: paymentId } });
      if (!payment) throw new BusinessRuleException('Payment not found', ErrorCode.NOT_FOUND);
      if (payment.status !== 'POSTED') throw new BusinessRuleException('Payment must be POSTED to reconcile', ErrorCode.VALIDATION_ERROR);

      await tx.bankStatement.update({
        where: { id: statementLineId },
        data: {
          is_matched: true,
          matched_payment_id: paymentId,
          matched_at: new Date()
        }
      });

      await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: 'RECONCILED'
        }
      });
    });
  }

  async getOutstandingItems(bankAccountId: UUID): Promise<OutstandingItems> {
    const outstandingPayments = await this.prisma.payment.findMany({
      where: {
        status: 'POSTED',
        // In real app, filter by payment method linking to bankAccountId
      }
    });

    const deposits = outstandingPayments.filter(p => p.payment_type === 'RECEIPT');
    const checks = outstandingPayments.filter(p => p.payment_type === 'VOUCHER');

    return {
      deposits_in_transit: deposits as any,
      outstanding_checks: checks as any,
      bank_charges: []
    };
  }
}
