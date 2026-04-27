import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { UUID } from '../../common/types/uuid.type';
import { BusinessRuleException } from '../../common/exceptions/business-rule.exception';
import { ErrorCode } from '../../common/enums/error-codes.enum';

/**
 * POS Service — enforces SOD-003 and other POS business rules.
 *
 * SOD-003: Kasir tidak bisa void transaksinya sendiri.
 * Validates: Requirements 5.10, 5.11
 */
@Injectable()
export class PosService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Void a POS transaction.
   *
   * SOD-003: The supervisor performing the void must NOT be the same user
   * who created (cashier_id) the transaction.
   *
   * @throws BusinessRuleException (422 BUSINESS_RULE_VIOLATION) on SOD-003 violation
   */
  async voidTransaction(
    transactionId: UUID,
    supervisorId: UUID,
    reason: string,
  ): Promise<void> {
    const transaction = await this.prisma.posTransaction.findUnique({
      where: { id: transactionId },
      select: { cashier_id: true, status: true },
    });

    if (!transaction) {
      throw new BusinessRuleException(
        `POS Transaction ${transactionId} not found`,
        ErrorCode.NOT_FOUND,
      );
    }

    // SOD-003 check — must happen BEFORE any DB writes
    if (transaction.cashier_id === supervisorId) {
      throw new BusinessRuleException(
        'SOD-003: Kasir tidak bisa void transaksinya sendiri',
        ErrorCode.BUSINESS_RULE_VIOLATION,
      );
    }

    if (transaction.status === 'VOIDED') {
      throw new BusinessRuleException(
        'Transaksi sudah di-void sebelumnya',
        ErrorCode.BUSINESS_RULE_VIOLATION,
      );
    }

    await this.prisma.posTransaction.update({
      where: { id: transactionId },
      data: {
        status: 'VOIDED',
        void_reason: reason,
        voided_by: supervisorId,
        voided_at: new Date(),
      },
    });
  }
}
