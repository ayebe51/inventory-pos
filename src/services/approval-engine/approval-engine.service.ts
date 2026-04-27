import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { PrismaService } from '../../config/prisma.service';
import { UUID } from '../../common/types/uuid.type';
import {
  ApprovalChain,
  ApprovalDecision,
  ApprovalMatrixService,
  ApprovalRequest,
  DocumentType,
} from '../../modules/governance/interfaces/governance.interfaces';
import { BusinessRuleException } from '../../common/exceptions/business-rule.exception';
import { ErrorCode } from '../../common/enums/error-codes.enum';

// ── Approval threshold constants (BR-PUR-007) ────────────────────────────────

export const APPROVAL_THRESHOLDS = {
  LEVEL_1_MAX: 5_000_000,   // < 5jt  → Supervisor
  LEVEL_2_MAX: 50_000_000,  // 5jt–50jt → Finance_Manager
  // > 50jt → Owner
} as const;

export const APPROVAL_ROLES = {
  LEVEL_1: 'Supervisor',
  LEVEL_2: 'Finance_Manager',
  LEVEL_3: 'Owner',
} as const;

// ── Input validation ──────────────────────────────────────────────────────────

const getApprovalChainSchema = z.object({
  amount: z.number().min(0, 'Amount must be >= 0'),
  branchId: z.string().uuid('branchId must be a valid UUID'),
});

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class ApprovalEngineService implements ApprovalMatrixService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Determine the approval chain for a document based on its total amount
   * (including tax — BR-PUR-007) and the branch it belongs to.
   *
   * Thresholds:
   *   Level 1 : amount < 5,000,000        → Supervisor
   *   Level 2 : 5,000,000 ≤ amount ≤ 50,000,000 → Finance_Manager
   *   Level 3 : amount > 50,000,000       → Owner
   */
  async getApprovalChain(
    _documentType: DocumentType,
    amount: number,
    branchId: UUID,
  ): Promise<ApprovalChain> {
    // Validate inputs
    getApprovalChainSchema.parse({ amount, branchId });

    // Determine level, role, and thresholds
    let level: 1 | 2 | 3;
    let requiredRole: string;
    let thresholdMin: number;
    let thresholdMax: number | null;

    if (amount < APPROVAL_THRESHOLDS.LEVEL_1_MAX) {
      level = 1;
      requiredRole = APPROVAL_ROLES.LEVEL_1;
      thresholdMin = 0;
      thresholdMax = APPROVAL_THRESHOLDS.LEVEL_1_MAX;
    } else if (amount <= APPROVAL_THRESHOLDS.LEVEL_2_MAX) {
      level = 2;
      requiredRole = APPROVAL_ROLES.LEVEL_2;
      thresholdMin = APPROVAL_THRESHOLDS.LEVEL_1_MAX;
      thresholdMax = APPROVAL_THRESHOLDS.LEVEL_2_MAX;
    } else {
      level = 3;
      requiredRole = APPROVAL_ROLES.LEVEL_3;
      thresholdMin = APPROVAL_THRESHOLDS.LEVEL_2_MAX;
      thresholdMax = null;
    }

    // Query users in the branch that have the required role
    const userRoles = await this.prisma.userRole.findMany({
      where: {
        branch_id: branchId,
        role: { name: requiredRole },
        user: { is_active: true, deleted_at: null },
      },
      include: {
        user: {
          select: { id: true, full_name: true, email: true },
        },
      },
    });

    const approvers = userRoles.map((ur) => ({
      id: ur.user.id as UUID,
      full_name: ur.user.full_name,
      email: ur.user.email,
    }));

    return { level, requiredRole, thresholdMin, thresholdMax, approvers };
  }

  /**
   * Approve a document (PO or Payment) with SOD enforcement.
   *
   * SOD-001: PO approver must not be the same user who created the PO.
   * SOD-002: Payment approver must not be the same user who created the payment.
   *
   * Validates: Requirements 3.4, 7.13, 7.14
   */
  async approve(
    documentType: 'PURCHASE_ORDER' | 'PAYMENT',
    documentId: UUID,
    approverId: UUID,
  ): Promise<void> {
    if (documentType === 'PURCHASE_ORDER') {
      const po = await this.prisma.purchaseOrder.findUnique({
        where: { id: documentId },
        select: { created_by: true },
      });

      if (!po) {
        throw new BusinessRuleException(
          `Purchase Order ${documentId} not found`,
          ErrorCode.NOT_FOUND,
        );
      }

      if (po.created_by === approverId) {
        throw new BusinessRuleException(
          'SOD-001: Pembuat PO tidak bisa menjadi approver PO yang sama',
          ErrorCode.BUSINESS_RULE_VIOLATION,
        );
      }
    } else if (documentType === 'PAYMENT') {
      const payment = await this.prisma.payment.findUnique({
        where: { id: documentId },
        select: { created_by: true },
      });

      if (!payment) {
        throw new BusinessRuleException(
          `Payment ${documentId} not found`,
          ErrorCode.NOT_FOUND,
        );
      }

      if (payment.created_by === approverId) {
        throw new BusinessRuleException(
          'SOD-002: Pembuat payment tidak bisa menjadi approver payment yang sama',
          ErrorCode.BUSINESS_RULE_VIOLATION,
        );
      }
    }
  }

  // ── Stubs — implemented in later tasks ───────────────────────────────────

  async submitForApproval(
    _documentId: UUID,
    _documentType: DocumentType,
  ): Promise<ApprovalRequest> {
    throw new Error('Not implemented');
  }

  async processApproval(
    _requestId: UUID,
    _approverId: UUID,
    _decision: ApprovalDecision,
  ): Promise<void> {
    throw new Error('Not implemented');
  }

  async escalate(_requestId: UUID): Promise<void> {
    throw new Error('Not implemented');
  }
}
