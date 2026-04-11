/**
 * withAudit — helper that wraps a business operation and its audit log
 * inside a single Prisma transaction, satisfying Requirement 1 AC 12:
 *
 *   "WHEN operasi mutasi dilakukan, THE Audit_Service SHALL mencatat log
 *    dalam transaksi database yang sama sehingga log tidak bisa ada tanpa
 *    operasi yang berhasil"
 *
 * Usage:
 *
 *   const result = await withAudit(
 *     this.prisma,
 *     this.auditService,
 *     { userId, action, entityType, entityId, before, after, ipAddress, userAgent },
 *     (tx) => this.doBusinessOperation(tx, data),
 *   );
 */

import { PrismaService } from '../../config/prisma.service';
import { AuditService } from './audit.service';
import { AuditEvent } from '../../modules/governance/interfaces/governance.interfaces';
import { Prisma } from '@prisma/client';

export interface WithAuditOptions {
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Execute `operation` and write an audit log entry inside the **same**
 * Prisma transaction.  If either the operation or the audit write fails,
 * the entire transaction is rolled back.
 *
 * @param prisma      - PrismaService (provides `$transaction`)
 * @param audit       - AuditService instance
 * @param opts        - Audit event metadata
 * @param operation   - Async callback that receives the transaction client and
 *                      returns the business result
 */
export async function withAudit<T>(
  prisma: PrismaService,
  audit: AuditService,
  opts: WithAuditOptions,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    const result = await operation(tx);

    const event: AuditEvent = {
      user_id: opts.userId,
      action: opts.action,
      entity_type: opts.entityType,
      entity_id: opts.entityId,
      before_snapshot: opts.before,
      after_snapshot: opts.after,
      ip_address: opts.ipAddress,
      user_agent: opts.userAgent,
    };

    await audit.record(event, tx);

    return result;
  });
}
