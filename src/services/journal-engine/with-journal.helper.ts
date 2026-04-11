/**
 * withJournal — wraps a business operation and its auto journal entry inside
 * a single Prisma transaction, satisfying the atomicity requirement:
 *
 *   "Transaksi bisnis + auto journal HARUS dalam satu DB transaction;
 *    rollback keduanya jika gagal"
 *
 * Usage:
 *
 *   const [result, journalEntries] = await withJournal(
 *     this.prisma,
 *     this.journalEngine,
 *     event,
 *     (tx) => this.doBusinessOperation(tx, data),
 *   );
 */

import { Prisma } from '@prisma/client';
import { PrismaService } from '../../config/prisma.service';
import { JournalEngineService } from './journal-engine.service';
import { BusinessEvent, JournalEntry } from '../../modules/accounting/interfaces/accounting.interfaces';

/**
 * Execute `operation` and write the corresponding auto journal entry inside
 * the **same** Prisma transaction.  If either the business operation or the
 * journal write fails, the entire transaction is rolled back.
 *
 * @param prisma         - PrismaService (provides `$transaction`)
 * @param journalEngine  - JournalEngineService instance
 * @param event          - BusinessEvent describing the journal to create
 * @param operation      - Async callback that receives the transaction client
 *                         and returns the business result
 * @returns              - Tuple of [businessResult, journalEntries]
 */
export async function withJournal<T>(
  prisma: PrismaService,
  journalEngine: JournalEngineService,
  event: BusinessEvent,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<[T, JournalEntry[]]> {
  return prisma.$transaction(async (tx) => {
    // Run the business operation first so its data is visible within the tx
    const result = await operation(tx);

    // Create the journal entry inside the same transaction
    const journalEntries = await journalEngine.processEvent(event, tx);

    return [result, journalEntries];
  });
}
