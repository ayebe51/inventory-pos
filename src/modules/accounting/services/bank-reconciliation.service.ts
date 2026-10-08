import { Injectable, Logger, BadRequestException } from '@nestjs/common';
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
  statement_id: string;
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
   * Parse and validate CSV content of a bank statement
   * Enforces:
   * - Max row limit (5,000 rows)
   * - Required header structure (Date, Description, Amount, Reference)
   * - Strict date parsing and numerical amount validation
   * - CSV / Formula injection sanitization (protects against =, +, -, @, \t, \r)
   */
  parseStatement(csvContent: string): BankStatementRow[] {
    if (!csvContent || !csvContent.trim()) {
      throw new BadRequestException('CSV file content is empty');
    }

    const lines = csvContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
      throw new BadRequestException('CSV file must contain a header row and at least one data row');
    }

    // Row count limits to protect memory & CPU
    const MAX_ROWS = 5000;
    if (lines.length - 1 > MAX_ROWS) {
      throw new BadRequestException(`CSV row limit exceeded: maximum ${MAX_ROWS} rows allowed per upload`);
    }

    // Validate and locate header columns
    const headerLine = lines[0];
    const headers = headerLine.split(',').map((h) => h.trim().toLowerCase().replace(/['"]/g, ''));

    const dateIdx = headers.findIndex((h) => h.includes('date'));
    const descIdx = headers.findIndex((h) => h.includes('desc') || h.includes('keterangan') || h.includes('narration'));
    const amountIdx = headers.findIndex((h) => h.includes('amount') || h.includes('nominal') || h.includes('jumlah'));
    const refIdx = headers.findIndex((h) => h.includes('ref') || h.includes('no') || h.includes('code'));

    if (dateIdx === -1 || descIdx === -1 || amountIdx === -1 || refIdx === -1) {
      throw new BadRequestException('Malformed CSV: missing required headers (Date, Description, Amount, Reference)');
    }

    const rows: BankStatementRow[] = [];

    // Helper: Sanitize against CSV / Formula Injection
    const sanitizeFormula = (val: string): string => {
      // Remove outer quotes if present without trimming leading tabs/cr
      let raw = val.replace(/^["']|["']$/g, '');
      // If cell begins with formula trigger character (=, +, -, @, tab, cr), neutralize it
      if (/^[=+\-@\t\r]/.test(raw)) {
        return `'${raw}`;
      }
      return raw.trim();
    };

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const parts = line.split(',');
      if (parts.length < 4) {
        throw new BadRequestException(`Malformed CSV at row ${i + 1}: expected at least 4 columns`);
      }

      const rawDate = (parts[dateIdx] || '').trim();
      const parsedDate = new Date(rawDate);
      if (isNaN(parsedDate.getTime())) {
        throw new BadRequestException(`Malformed CSV at row ${i + 1}: invalid date format "${rawDate}"`);
      }

      const rawAmount = (parts[amountIdx] || '').replace(/[^0-9.-]/g, '');
      const amount = parseFloat(rawAmount);
      if (isNaN(amount)) {
        throw new BadRequestException(`Malformed CSV at row ${i + 1}: invalid amount "${parts[amountIdx]}"`);
      }

      const description = sanitizeFormula(parts[descIdx] || '');
      const reference = sanitizeFormula(parts[refIdx] || '');

      rows.push({
        date: rawDate,
        description,
        amount,
        reference,
      });
    }

    return rows;
  }

  /**
   * Upload and persist bank statement CSV
   */
  async uploadStatement(bankAccountId: UUID, csvContent: string): Promise<any[]> {
    const rows = this.parseStatement(csvContent);

    return await this.prisma.$transaction(async (tx) => {
      const statements: any[] = [];
      for (const row of rows) {
        const statement = await tx.bankStatement.create({
          data: {
            bank_account_id: bankAccountId,
            statement_date: new Date(row.date),
            reference_number: row.reference,
            description: row.description,
            amount: row.amount,
            transaction_type: row.amount >= 0 ? 'CREDIT' : 'DEBIT',
            is_matched: false,
          },
        });
        statements.push(statement);
      }
      return statements;
    });
  }

  /**
   * Auto-match statement rows from DB with system payments
   */
  async autoMatch(bankAccountId: UUID, fromDate: Date, toDate: Date): Promise<ReconciliationMatch[]> {
    const matches: ReconciliationMatch[] = [];

    // Fetch unmatched statements in range
    const statements = await this.prisma.bankStatement.findMany({
      where: {
        bank_account_id: bankAccountId,
        is_matched: false,
        statement_date: {
          gte: fromDate,
          lte: toDate,
        },
      },
    });

    // Fetch all unreconciled POSTED payments
    const payments = await this.prisma.payment.findMany({
      where: {
        status: 'POSTED',
      },
    });

    for (const stmt of statements) {
      let bestMatch: any = null;
      let highestScore = 0;

      for (const payment of payments) {
        let score = 0;

        // Exact amount match: +50 points
        if (Math.abs(Number(payment.amount)) === Math.abs(Number(stmt.amount))) {
          score += 50;
        }

        // Exact reference match: +50 points
        if (stmt.reference_number && payment.payment_number.includes(stmt.reference_number)) {
          score += 50;
        }

        if (score > highestScore) {
          highestScore = score;
          bestMatch = payment;
        }
      }

      if (bestMatch && highestScore >= 50) {
        matches.push({
          statement_id: stmt.id,
          payment_id: bestMatch.id,
          payment_number: bestMatch.payment_number,
          match_score: highestScore,
          status: 'MATCHED',
        });
      } else {
        matches.push({
          statement_id: stmt.id,
          payment_id: null,
          payment_number: null,
          match_score: 0,
          status: 'UNMATCHED',
        });
      }
    }

    return matches;
  }

  /**
   * Confirm reconciliation for matched payments
   */
  async confirmReconciliation(matches: { statementId: UUID; paymentId: UUID }[], userId: UUID): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      for (const match of matches) {
        const payment = await tx.payment.findUnique({ where: { id: match.paymentId } });
        if (!payment || payment.status !== 'POSTED') {
          throw new BusinessRuleException(`Payment ${match.paymentId} invalid or not POSTED`, ErrorCode.BUSINESS_RULE_VIOLATION);
        }

        await tx.payment.update({
          where: { id: match.paymentId },
          data: { status: 'RECONCILED' },
        });

        await tx.bankStatement.update({
          where: { id: match.statementId },
          data: {
            is_matched: true,
            matched_payment_id: match.paymentId,
            matched_at: new Date(),
          },
        });
      }
    });

    this.logger.log(`Reconciled ${matches.length} bank statements by user ${userId}`);
  }
}
