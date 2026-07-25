import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma.service';
import { BusinessRuleException } from '../../../common/exceptions/business-rule.exception';
import { ErrorCode } from '../../../common/enums/error-codes.enum';
import { UUID } from '../../../common/types/uuid.type';

export interface BankStatementRow {
  date: string;
  description: string;
  amount: number;
  reference: string;
}

export interface ReconciliationMatch {
  statement_row: BankStatementRow;
  payment_id: string | null;
  payment_number: string | null;
  match_score: number; // 0-100
  status: 'MATCHED' | 'UNMATCHED';
}

@Injectable()
export class BankReconciliationService {
  private readonly logger = new Logger(BankReconciliationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Parse CSV content of a bank statement
   */
  parseStatement(csvContent: string): BankStatementRow[] {
    const lines = csvContent.split('\n');
    const rows: BankStatementRow[] = [];
    
    // Skip header (assuming 1st line is header: Date,Description,Amount,Reference)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const parts = line.split(',');
      if (parts.length >= 4) {
        rows.push({
          date: parts[0].trim(),
          description: parts[1].trim(),
          amount: parseFloat(parts[2].trim()) || 0,
          reference: parts[3].trim(),
        });
      }
    }
    return rows;
  }

  /**
   * Auto-match statement rows with system payments
   */
  async autoMatch(rows: BankStatementRow[]): Promise<ReconciliationMatch[]> {
    const matches: ReconciliationMatch[] = [];
    
    // Fetch all unreconciled POSTED payments
    const payments = await this.prisma.payment.findMany({
      where: {
        status: 'POSTED',
      }
    });

    for (const row of rows) {
      let bestMatch = null;
      let highestScore = 0;

      for (const payment of payments) {
        let score = 0;
        
        // Exact amount match: +50 points
        if (Math.abs(Number(payment.amount)) === Math.abs(row.amount)) {
          score += 50;
        }

        // Exact reference match: +50 points
        if (row.reference && payment.payment_number.includes(row.reference)) {
          score += 50;
        }

        if (score > highestScore) {
          highestScore = score;
          bestMatch = payment;
        }
      }

      if (bestMatch && highestScore >= 50) {
        matches.push({
          statement_row: row,
          payment_id: bestMatch.id,
          payment_number: bestMatch.payment_number,
          match_score: highestScore,
          status: 'MATCHED'
        });
      } else {
        matches.push({
          statement_row: row,
          payment_id: null,
          payment_number: null,
          match_score: 0,
          status: 'UNMATCHED'
        });
      }
    }

    return matches;
  }

  /**
   * Confirm reconciliation for matched payments
   */
  async confirmReconciliation(paymentIds: UUID[], userId: UUID): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      for (const id of paymentIds) {
        const payment = await tx.payment.findUnique({ where: { id } });
        if (!payment) {
          throw new BusinessRuleException(`Payment ${id} not found`, ErrorCode.NOT_FOUND);
        }
        
        if (payment.status !== 'POSTED') {
          throw new BusinessRuleException(`Payment ${id} is not POSTED`, ErrorCode.BUSINESS_RULE_VIOLATION);
        }

        await tx.payment.update({
          where: { id },
          data: { status: 'RECONCILED' }
        });
      }
    });
    
    this.logger.log(`Reconciled ${paymentIds.length} payments by user ${userId}`);
  }
}
