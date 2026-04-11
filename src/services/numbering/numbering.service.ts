import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';

export enum DocumentType {
  PR = 'PR',   // Purchase Request
  PO = 'PO',   // Purchase Order
  GR = 'GR',   // Goods Receipt
  INV = 'INV', // Sales Invoice
  POS = 'POS', // POS Transaction
  RCV = 'RCV', // Payment Receipt
  PV = 'PV',   // Payment Voucher
  JE = 'JE',   // Journal Entry
  SA = 'SA',   // Stock Adjustment
  SO = 'SO',   // Stock Opname
  CN = 'CN',   // Credit Note
  DN = 'DN',   // Debit Note
  TO = 'TO',   // Transfer Order
}

/** POS uses daily period (YYYYMMDD); all others use monthly (YYYYMM) */
const DAILY_PERIOD_TYPES = new Set<DocumentType>([DocumentType.POS]);

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 50;

interface SequenceRow {
  next_val: bigint;
}

@Injectable()
export class NumberingService {
  private readonly logger = new Logger(NumberingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate a unique document number for the given type.
   * Format:
   *   - POS: POS-YYYYMMDD-XXXXX  (daily counter, 5-digit zero-padded)
   *   - All others: PREFIX-YYYYMM-XXXXX  (monthly counter, 5-digit zero-padded)
   *
   * Uses DB-level atomic upsert with PRIMARY KEY (prefix, period) as the unique
   * constraint, plus exponential backoff retry (max 3 attempts) to handle
   * transient race conditions.
   */
  async generate(type: DocumentType, date?: Date): Promise<string> {
    const effectiveDate = date ?? new Date();
    const period = this.buildPeriod(type, effectiveDate);

    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const seq = await this.atomicIncrement(type, period);
        return this.formatDocumentNumber(type, period, seq);
      } catch (err) {
        lastError = err;
        this.logger.warn(
          `NumberingService: attempt ${attempt}/${MAX_RETRIES} failed for ${type}-${period}: ${(err as Error).message}`,
        );

        if (attempt < MAX_RETRIES) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        }
      }
    }

    throw new Error(
      `NumberingService: failed to generate number for ${type} after ${MAX_RETRIES} attempts. Last error: ${(lastError as Error).message}`,
    );
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private buildPeriod(type: DocumentType, date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    if (DAILY_PERIOD_TYPES.has(type)) {
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}${month}${day}`;
    }

    return `${year}${month}`;
  }

  private formatDocumentNumber(type: DocumentType, period: string, seq: number): string {
    const counter = String(seq).padStart(5, '0');
    return `${type}-${period}-${counter}`;
  }

  /**
   * Atomically increment (or create) the counter for (prefix, period).
   *
   * The PRIMARY KEY (prefix, period) on document_sequences is the DB-level
   * unique constraint that prevents duplicate entries. The INSERT ... ON CONFLICT
   * DO UPDATE pattern guarantees atomic read-modify-write without a separate
   * SELECT, making it safe under concurrent load.
   */
  private async atomicIncrement(type: DocumentType, period: string): Promise<number> {
    const result = await this.prisma.$queryRaw<SequenceRow[]>`
      INSERT INTO document_sequences (prefix, period, last_value, updated_at)
      VALUES (${type}, ${period}, 1, NOW())
      ON CONFLICT (prefix, period)
      DO UPDATE SET
        last_value = document_sequences.last_value + 1,
        updated_at = NOW()
      RETURNING last_value AS next_val
    `;

    if (!result || result.length === 0) {
      throw new Error('atomicIncrement: no row returned from upsert');
    }

    return Number(result[0].next_val);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
