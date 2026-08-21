import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PurchaseOrderService } from './purchase-order.service';
import { PrismaService } from '../../../config/prisma.service';
import { AuditService } from '../../../services/audit/audit.service';
import { NumberingService } from '../../../services/numbering/numbering.service';
import { RbacService } from '../../../services/rbac/rbac.service';
import { BusinessRuleException } from '../../../common/exceptions/business-rule.exception';
import { ErrorCode } from '../../../common/enums/error-codes.enum';
import { UUID } from '../../../common/types/uuid.type';
import { POStatus } from '../interfaces/purchase.interfaces';

describe('PurchaseOrderService - Approval & Rejection with RBAC and SOD-001', () => {
  let service: PurchaseOrderService;
  let prisma: PrismaService;
  let rbac: RbacService;
  let audit: AuditService;

  const mockUserId = 'user-123' as UUID;
  const mockApproverId = 'approver-456' as UUID;
  const mockPoId = 'po-789' as UUID;

  const mockPO = {
    id: mockPoId,
    po_number: 'PO-202501-00001',
    pr_id: null,
    supplier_id: 'supplier-1' as UUID,
    branch_id: 'branch-1' as UUID,
    warehouse_id: 'warehouse-1' as UUID,
    status: 'PENDING_APPROVAL' as POStatus,
    order_date: new Date('2025-01-15'),
    expected_delivery_date: null,
    currency: 'IDR',
    exchange_rate: new Decimal(1),
    subtotal: new Decimal(10000000),
    tax_amount: new Decimal(1100000),
    additional_cost: new Decimal(0),
    total_amount: new Decimal(11100000),
    approval_level: 2,
    approved_by: null,
    approved_at: null,
    notes: null,
    terms_of_payment_id: null,
    created_by: mockUserId,
    created_at: new Date('2025-01-15T10:00:00Z'),
    updated_at: new Date('2025-01-15T10:00:00Z'),
    deleted_at: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseOrderService,
        {
          provide: PrismaService,
          useValue: {
            purchaseOrder: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
        {
          provide: AuditService,
          useValue: {
            record: jest.fn(),
          },
        },
        {
          provide: NumberingService,
          useValue: {
            generate: jest.fn(),
          },
        },
        {
          provide: RbacService,
          useValue: {
            checkPermission: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PurchaseOrderService>(PurchaseOrderService);
    prisma = module.get<PrismaService>(PrismaService);
    rbac = module.get<RbacService>(RbacService);
    audit = module.get<AuditService>(AuditService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('approve()', () => {
    it('should approve PO when user has PURCHASE.APPROVE permission and is not the creator', async () => {
      // Arrange
      jest.spyOn(prisma.purchaseOrder, 'findUnique').mockResolvedValue(mockPO);
      jest.spyOn(rbac, 'checkPermission').mockResolvedValue(true);

      const updatedPO = {
        ...mockPO,
        status: 'APPROVED' as POStatus,
        approved_by: mockApproverId,
        approved_at: new Date(),
      };

      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        jest.spyOn(prisma.purchaseOrder, 'update').mockResolvedValue(updatedPO);
        return callback(prisma);
      });

      // Act
      const result = await service.approve(mockPoId, mockApproverId, 'Approved by manager');

      // Assert
      expect(rbac.checkPermission).toHaveBeenCalledWith(mockApproverId, 'PURCHASE.APPROVE');
      expect(prisma.purchaseOrder.update).toHaveBeenCalledWith({
        where: { id: mockPoId },
        data: expect.objectContaining({
          status: 'APPROVED',
          approved_by: mockApproverId,
          approved_at: expect.any(Date),
        }),
      });
      expect(result.status).toBe('APPROVED');
      expect(result.approved_by).toBe(mockApproverId);
    });

    it('should throw ForbiddenException when user does not have PURCHASE.APPROVE permission', async () => {
      // Arrange
      jest.spyOn(prisma.purchaseOrder, 'findUnique').mockResolvedValue(mockPO);
      jest.spyOn(rbac, 'checkPermission').mockResolvedValue(false);

      // Act & Assert
      await expect(service.approve(mockPoId, mockApproverId, 'Approved')).rejects.toThrow(
        ForbiddenException,
      );
      expect(rbac.checkPermission).toHaveBeenCalledWith(mockApproverId, 'PURCHASE.APPROVE');
      expect(prisma.purchaseOrder.update).not.toHaveBeenCalled();
    });

    it('should throw BusinessRuleException when approver is the same as creator (SOD-001)', async () => {
      // Arrange
      jest.spyOn(prisma.purchaseOrder, 'findUnique').mockResolvedValue(mockPO);
      jest.spyOn(rbac, 'checkPermission').mockResolvedValue(true);

      // Act & Assert - trying to approve with the same user who created it
      await expect(service.approve(mockPoId, mockUserId, 'Self-approval')).rejects.toThrow(
        BusinessRuleException,
      );
      expect(rbac.checkPermission).toHaveBeenCalledWith(mockUserId, 'PURCHASE.APPROVE');
      expect(prisma.purchaseOrder.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when PO does not exist', async () => {
      // Arrange
      jest.spyOn(prisma.purchaseOrder, 'findUnique').mockResolvedValue(null);

      // Act & Assert
      await expect(service.approve(mockPoId, mockApproverId, 'Approved')).rejects.toThrow(
        NotFoundException,
      );
      expect(rbac.checkPermission).not.toHaveBeenCalled();
    });

    it('should throw BusinessRuleException when PO is not in PENDING_APPROVAL status', async () => {
      // Arrange
      const draftPO = { ...mockPO, status: 'DRAFT' as POStatus };
      jest.spyOn(prisma.purchaseOrder, 'findUnique').mockResolvedValue(draftPO);
      jest.spyOn(rbac, 'checkPermission').mockResolvedValue(true);

      // Act & Assert
      await expect(service.approve(mockPoId, mockApproverId, 'Approved')).rejects.toThrow(
        BusinessRuleException,
      );
    });

    it('should record audit log when PO is approved', async () => {
      // Arrange
      jest.spyOn(prisma.purchaseOrder, 'findUnique').mockResolvedValue(mockPO);
      jest.spyOn(rbac, 'checkPermission').mockResolvedValue(true);

      const updatedPO = {
        ...mockPO,
        status: 'APPROVED' as POStatus,
        approved_by: mockApproverId,
        approved_at: new Date(),
      };

      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        jest.spyOn(prisma.purchaseOrder, 'update').mockResolvedValue(updatedPO);
        await callback(prisma);
        return updatedPO;
      });

      // Act
      await service.approve(mockPoId, mockApproverId, 'Approved');

      // Assert
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: mockApproverId,
          action: 'APPROVE',
          entity_type: 'PurchaseOrder',
          entity_id: mockPoId,
        }),
        prisma,
      );
    });
  });

  describe('reject()', () => {
    it('should reject PO when user has PURCHASE.APPROVE permission', async () => {
      // Arrange
      jest.spyOn(prisma.purchaseOrder, 'findUnique').mockResolvedValue(mockPO);
      jest.spyOn(rbac, 'checkPermission').mockResolvedValue(true);

      const rejectedPO = {
        ...mockPO,
        status: 'REJECTED' as POStatus,
        notes: 'Rejected: Budget exceeded',
      };

      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        jest.spyOn(prisma.purchaseOrder, 'update').mockResolvedValue(rejectedPO);
        return callback(prisma);
      });

      // Act
      const result = await service.reject(mockPoId, mockApproverId, 'Budget exceeded');

      // Assert
      expect(rbac.checkPermission).toHaveBeenCalledWith(mockApproverId, 'PURCHASE.APPROVE');
      expect(prisma.purchaseOrder.update).toHaveBeenCalledWith({
        where: { id: mockPoId },
        data: expect.objectContaining({
          status: 'REJECTED',
          notes: expect.stringContaining('Budget exceeded'),
        }),
      });
      expect(result.status).toBe('REJECTED');
    });

    it('should throw ForbiddenException when user does not have PURCHASE.APPROVE permission', async () => {
      // Arrange
      jest.spyOn(prisma.purchaseOrder, 'findUnique').mockResolvedValue(mockPO);
      jest.spyOn(rbac, 'checkPermission').mockResolvedValue(false);

      // Act & Assert
      await expect(
        service.reject(mockPoId, mockApproverId, 'Budget exceeded'),
      ).rejects.toThrow(ForbiddenException);
      expect(rbac.checkPermission).toHaveBeenCalledWith(mockApproverId, 'PURCHASE.APPROVE');
      expect(prisma.purchaseOrder.update).not.toHaveBeenCalled();
    });

    it('should throw BusinessRuleException when rejection reason is empty', async () => {
      // Arrange
      jest.spyOn(prisma.purchaseOrder, 'findUnique').mockResolvedValue(mockPO);

      // Act & Assert
      await expect(service.reject(mockPoId, mockApproverId, '')).rejects.toThrow(
        BusinessRuleException,
      );
      expect(rbac.checkPermission).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when PO does not exist', async () => {
      // Arrange
      jest.spyOn(prisma.purchaseOrder, 'findUnique').mockResolvedValue(null);

      // Act & Assert
      await expect(
        service.reject(mockPoId, mockApproverId, 'Budget exceeded'),
      ).rejects.toThrow(NotFoundException);
      expect(rbac.checkPermission).not.toHaveBeenCalled();
    });

    it('should throw BusinessRuleException when PO is not in PENDING_APPROVAL status', async () => {
      // Arrange
      const approvedPO = { ...mockPO, status: 'APPROVED' as POStatus };
      jest.spyOn(prisma.purchaseOrder, 'findUnique').mockResolvedValue(approvedPO);
      jest.spyOn(rbac, 'checkPermission').mockResolvedValue(true);

      // Act & Assert
      await expect(
        service.reject(mockPoId, mockApproverId, 'Budget exceeded'),
      ).rejects.toThrow(BusinessRuleException);
    });

    it('should record audit log when PO is rejected', async () => {
      // Arrange
      jest.spyOn(prisma.purchaseOrder, 'findUnique').mockResolvedValue(mockPO);
      jest.spyOn(rbac, 'checkPermission').mockResolvedValue(true);

      const rejectedPO = {
        ...mockPO,
        status: 'REJECTED' as POStatus,
        notes: 'Rejected: Budget exceeded',
      };

      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        jest.spyOn(prisma.purchaseOrder, 'update').mockResolvedValue(rejectedPO);
        await callback(prisma);
        return rejectedPO;
      });

      // Act
      await service.reject(mockPoId, mockApproverId, 'Budget exceeded');

      // Assert
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: mockApproverId,
          action: 'REJECT',
          entity_type: 'PurchaseOrder',
          entity_id: mockPoId,
        }),
        prisma,
      );
    });
  });

  describe('SOD-001 Enforcement', () => {
    it('should allow approval when approver is different from creator', async () => {
      // Arrange
      jest.spyOn(prisma.purchaseOrder, 'findUnique').mockResolvedValue(mockPO);
      jest.spyOn(rbac, 'checkPermission').mockResolvedValue(true);

      const updatedPO = {
        ...mockPO,
        status: 'APPROVED' as POStatus,
        approved_by: mockApproverId,
        approved_at: new Date(),
      };

      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        jest.spyOn(prisma.purchaseOrder, 'update').mockResolvedValue(updatedPO);
        return callback(prisma);
      });

      // Act
      const result = await service.approve(mockPoId, mockApproverId);

      // Assert
      expect(result.status).toBe('APPROVED');
      expect(result.created_by).not.toBe(result.approved_by);
    });

    it('should block approval when approver is the same as creator', async () => {
      // Arrange
      jest.spyOn(prisma.purchaseOrder, 'findUnique').mockResolvedValue(mockPO);
      jest.spyOn(rbac, 'checkPermission').mockResolvedValue(true);

      // Act & Assert
      await expect(service.approve(mockPoId, mockUserId)).rejects.toThrow(
        BusinessRuleException,
      );
    });
  });

  describe('RBAC Permission Validation', () => {
    it('should check PURCHASE.APPROVE permission before approving', async () => {
      // Arrange
      jest.spyOn(prisma.purchaseOrder, 'findUnique').mockResolvedValue(mockPO);
      jest.spyOn(rbac, 'checkPermission').mockResolvedValue(false);

      // Act & Assert
      await expect(service.approve(mockPoId, mockApproverId)).rejects.toThrow(
        ForbiddenException,
      );
      expect(rbac.checkPermission).toHaveBeenCalledWith(mockApproverId, 'PURCHASE.APPROVE');
    });

    it('should check PURCHASE.APPROVE permission before rejecting', async () => {
      // Arrange
      jest.spyOn(prisma.purchaseOrder, 'findUnique').mockResolvedValue(mockPO);
      jest.spyOn(rbac, 'checkPermission').mockResolvedValue(false);

      // Act & Assert
      await expect(
        service.reject(mockPoId, mockApproverId, 'Not approved'),
      ).rejects.toThrow(ForbiddenException);
      expect(rbac.checkPermission).toHaveBeenCalledWith(mockApproverId, 'PURCHASE.APPROVE');
    });

    it('should use the same permission for both approve and reject', async () => {
      // Arrange
      jest.spyOn(prisma.purchaseOrder, 'findUnique').mockResolvedValue(mockPO);
      jest.spyOn(rbac, 'checkPermission').mockResolvedValue(true);

      const updatedPO = { ...mockPO, status: 'APPROVED' as POStatus };
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        jest.spyOn(prisma.purchaseOrder, 'update').mockResolvedValue(updatedPO);
        return callback(prisma);
      });

      // Act - Approve
      await service.approve(mockPoId, mockApproverId);
      const approvePermissionCall = (rbac.checkPermission as jest.Mock).mock.calls[0];

      // Reset and test reject
      jest.clearAllMocks();
      jest.spyOn(prisma.purchaseOrder, 'findUnique').mockResolvedValue(mockPO);
      jest.spyOn(rbac, 'checkPermission').mockResolvedValue(true);

      const rejectedPO = { ...mockPO, status: 'REJECTED' as POStatus };
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        jest.spyOn(prisma.purchaseOrder, 'update').mockResolvedValue(rejectedPO);
        return callback(prisma);
      });

      await service.reject(mockPoId, mockApproverId, 'Rejected');
      const rejectPermissionCall = (rbac.checkPermission as jest.Mock).mock.calls[0];

      // Assert - Both should check the same permission
      expect(approvePermissionCall[1]).toBe('PURCHASE.APPROVE');
      expect(rejectPermissionCall[1]).toBe('PURCHASE.APPROVE');
    });
  });
});
