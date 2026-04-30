import { Test, TestingModule } from '@nestjs/testing';
import { PurchaseRequestService } from './purchase-request.service';
import { PrismaService } from '../../../config/prisma.service';
import { AuditService } from '../../../services/audit/audit.service';
import { NumberingService, DocumentType } from '../../../services/numbering/numbering.service';
import { BusinessRuleException } from '../../../common/exceptions/business-rule.exception';
import { ErrorCode } from '../../../common/enums/error-codes.enum';
import { NotFoundException } from '@nestjs/common';

describe('PurchaseRequestService', () => {
  let service: PurchaseRequestService;
  let prisma: PrismaService;
  let audit: AuditService;
  let numbering: NumberingService;

  const mockBranch = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    code: 'BR001',
    name: 'Branch 1',
    is_active: true,
    deleted_at: null,
  };

  const mockWarehouse = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    code: 'WH001',
    name: 'Warehouse 1',
    branch_id: '550e8400-e29b-41d4-a716-446655440000',
    is_active: true,
    deleted_at: null,
  };

  const mockProduct = {
    id: '550e8400-e29b-41d4-a716-446655440002',
    code: 'PROD001',
    name: 'Product 1',
    is_active: true,
    deleted_at: null,
  };

  const mockUOM = {
    id: '550e8400-e29b-41d4-a716-446655440003',
    code: 'PCS',
    name: 'Pieces',
    is_active: true,
  };

  const mockUserId = '550e8400-e29b-41d4-a716-446655440004';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseRequestService,
        {
          provide: PrismaService,
          useValue: {
            branch: {
              findUnique: jest.fn(),
            },
            warehouse: {
              findUnique: jest.fn(),
            },
            product: {
              findMany: jest.fn(),
            },
            unitOfMeasure: {
              findMany: jest.fn(),
            },
            purchaseRequest: {
              create: jest.fn(),
              findUnique: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
              update: jest.fn(),
            },
            purchaseRequestLine: {
              create: jest.fn(),
              deleteMany: jest.fn(),
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
      ],
    }).compile();

    service = module.get<PurchaseRequestService>(PurchaseRequestService);
    prisma = module.get<PrismaService>(PrismaService);
    audit = module.get<AuditService>(AuditService);
    numbering = module.get<NumberingService>(NumberingService);
  });

  describe('create', () => {
    const validCreateData = {
      branch_id: '550e8400-e29b-41d4-a716-446655440000',
      warehouse_id: '550e8400-e29b-41d4-a716-446655440001',
      notes: 'Test PR',
      lines: [
        {
          product_id: '550e8400-e29b-41d4-a716-446655440002',
          qty_requested: 10,
          uom_id: '550e8400-e29b-41d4-a716-446655440003',
          estimated_price: 1000,
        },
      ],
    };

    it('should create a purchase request with DRAFT status and PR-YYYYMM-XXXXX number', async () => {
      const prNumber = 'PR-202501-00001';
      const mockPR = {
        id: '550e8400-e29b-41d4-a716-446655440005',
        pr_number: prNumber,
        branch_id: validCreateData.branch_id,
        warehouse_id: validCreateData.warehouse_id,
        status: 'DRAFT',
        requested_by: mockUserId,
        notes: validCreateData.notes,
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
      };

      const mockLine = {
        id: '550e8400-e29b-41d4-a716-446655440006',
        pr_id: '550e8400-e29b-41d4-a716-446655440005',
        product_id: validCreateData.lines[0].product_id,
        qty_requested: validCreateData.lines[0].qty_requested,
        uom_id: validCreateData.lines[0].uom_id,
        estimated_price: validCreateData.lines[0].estimated_price,
        notes: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      jest.spyOn(prisma.branch, 'findUnique').mockResolvedValue(mockBranch as any);
      jest.spyOn(prisma.warehouse, 'findUnique').mockResolvedValue(mockWarehouse as any);
      jest.spyOn(prisma.product, 'findMany').mockResolvedValue([mockProduct] as any);
      jest.spyOn(prisma.unitOfMeasure, 'findMany').mockResolvedValue([mockUOM] as any);
      jest.spyOn(numbering, 'generate').mockResolvedValue(prNumber);
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        return callback({
          purchaseRequest: {
            create: jest.fn().mockResolvedValue(mockPR),
          },
          purchaseRequestLine: {
            create: jest.fn().mockResolvedValue(mockLine),
          },
        });
      });
      jest.spyOn(audit, 'record').mockResolvedValue({} as any);

      const result = await service.create(validCreateData, mockUserId);

      expect(result.pr_number).toBe(prNumber);
      expect(result.status).toBe('DRAFT');
      expect(result.branch_id).toBe(validCreateData.branch_id);
      expect(result.warehouse_id).toBe(validCreateData.warehouse_id);
      expect(result.lines).toHaveLength(1);
      expect(numbering.generate).toHaveBeenCalledWith(DocumentType.PR);
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CREATE',
          entity_type: 'PurchaseRequest',
        }),
      );
    });

    it('should reject if branch does not exist or is inactive', async () => {
      jest.spyOn(prisma.branch, 'findUnique').mockResolvedValue(null);

      await expect(service.create(validCreateData, mockUserId)).rejects.toThrow(BusinessRuleException);
    });

    it('should reject if warehouse does not exist or is inactive', async () => {
      jest.spyOn(prisma.branch, 'findUnique').mockResolvedValue(mockBranch as any);
      jest.spyOn(prisma.warehouse, 'findUnique').mockResolvedValue(null);

      await expect(service.create(validCreateData, mockUserId)).rejects.toThrow(BusinessRuleException);
    });

    it('should reject if warehouse does not belong to the branch', async () => {
      jest.spyOn(prisma.branch, 'findUnique').mockResolvedValue(mockBranch as any);
      jest.spyOn(prisma.warehouse, 'findUnique').mockResolvedValue({
        ...mockWarehouse,
        branch_id: 'different-branch',
      } as any);

      await expect(service.create(validCreateData, mockUserId)).rejects.toThrow(BusinessRuleException);
    });

    it('should reject if any product does not exist or is inactive', async () => {
      jest.spyOn(prisma.branch, 'findUnique').mockResolvedValue(mockBranch as any);
      jest.spyOn(prisma.warehouse, 'findUnique').mockResolvedValue(mockWarehouse as any);
      jest.spyOn(prisma.product, 'findMany').mockResolvedValue([]);

      await expect(service.create(validCreateData, mockUserId)).rejects.toThrow(BusinessRuleException);
    });

    it('should reject if any UOM does not exist or is inactive', async () => {
      jest.spyOn(prisma.branch, 'findUnique').mockResolvedValue(mockBranch as any);
      jest.spyOn(prisma.warehouse, 'findUnique').mockResolvedValue(mockWarehouse as any);
      jest.spyOn(prisma.product, 'findMany').mockResolvedValue([mockProduct] as any);
      jest.spyOn(prisma.unitOfMeasure, 'findMany').mockResolvedValue([]);

      await expect(service.create(validCreateData, mockUserId)).rejects.toThrow(BusinessRuleException);
    });

    it('should reject if lines array is empty', async () => {
      const invalidData = {
        ...validCreateData,
        lines: [],
      };

      await expect(service.create(invalidData, mockUserId)).rejects.toThrow();
    });

    it('should reject if qty_requested is not positive', async () => {
      const invalidData = {
        ...validCreateData,
        lines: [
          {
            ...validCreateData.lines[0],
            qty_requested: 0,
          },
        ],
      };

      await expect(service.create(invalidData, mockUserId)).rejects.toThrow();
    });
  });

  describe('findById', () => {
    it('should return purchase request with lines', async () => {
      const mockPR = {
        id: '550e8400-e29b-41d4-a716-446655440009',
        pr_number: 'PR-202501-00001',
        branch_id: '550e8400-e29b-41d4-a716-446655440000',
        warehouse_id: '550e8400-e29b-41d4-a716-446655440001',
        status: 'DRAFT',
        requested_by: mockUserId,
        notes: 'Test',
        created_at: new Date(),
        updated_at: new Date(),
        deleted_at: null,
        lines: [
          {
            id: '550e8400-e29b-41d4-a716-446655440010',
            pr_id: '550e8400-e29b-41d4-a716-446655440009',
            product_id: '550e8400-e29b-41d4-a716-446655440002',
            qty_requested: 10,
            uom_id: '550e8400-e29b-41d4-a716-446655440003',
            estimated_price: 1000,
            notes: null,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
      };

      jest.spyOn(prisma.purchaseRequest, 'findUnique').mockResolvedValue(mockPR as any);

      const result = await service.findById('pr-1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('550e8400-e29b-41d4-a716-446655440009');
      expect(result?.lines).toHaveLength(1);
    });

    it('should return null if purchase request not found', async () => {
      jest.spyOn(prisma.purchaseRequest, 'findUnique').mockResolvedValue(null);

      const result = await service.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    const mockExistingPR = {
      id: '550e8400-e29b-41d4-a716-446655440005',
      pr_number: 'PR-202501-00001',
      branch_id: '550e8400-e29b-41d4-a716-446655440000',
      warehouse_id: '550e8400-e29b-41d4-a716-446655440001',
      status: 'DRAFT' as const,
      requested_by: mockUserId,
      notes: 'Original',
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
      lines: [
        {
          id: '550e8400-e29b-41d4-a716-446655440006',
          pr_id: '550e8400-e29b-41d4-a716-446655440005',
          product_id: '550e8400-e29b-41d4-a716-446655440002',
          qty_requested: 10,
          uom_id: '550e8400-e29b-41d4-a716-446655440003',
          estimated_price: 1000,
          notes: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ],
    };

    it('should update purchase request notes', async () => {
      jest.spyOn(service, 'findById').mockResolvedValue(mockExistingPR);
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        return callback({
          purchaseRequest: {
            update: jest.fn().mockResolvedValue({
              ...mockExistingPR,
              notes: 'Updated',
            }),
          },
        });
      });
      jest.spyOn(audit, 'record').mockResolvedValue({} as any);

      const result = await service.update('pr-1', { notes: 'Updated' }, mockUserId);

      expect(result.notes).toBe('Updated');
    });

    it('should reject update if PR is not in DRAFT status', async () => {
      jest.spyOn(service, 'findById').mockResolvedValue({
        ...mockExistingPR,
        status: 'SUBMITTED',
      });

      await expect(service.update('pr-1', { notes: 'Updated' }, mockUserId)).rejects.toThrow(
        BusinessRuleException,
      );
    });

    it('should reject if PR not found', async () => {
      jest.spyOn(service, 'findById').mockResolvedValue(null);

      await expect(service.update('non-existent', { notes: 'Updated' }, mockUserId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('delete', () => {
    const mockExistingPR = {
      id: 'pr-1',
      pr_number: 'PR-202501-00001',
      branch_id: 'branch-1',
      warehouse_id: 'warehouse-1',
      status: 'DRAFT' as const,
      requested_by: mockUserId,
      notes: 'Test',
      created_at: new Date(),
      updated_at: new Date(),
      deleted_at: null,
      lines: [],
    };

    it('should soft delete purchase request in DRAFT status', async () => {
      jest.spyOn(service, 'findById').mockResolvedValue(mockExistingPR);
      jest.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        return callback({
          purchaseRequest: {
            update: jest.fn().mockResolvedValue({
              ...mockExistingPR,
              deleted_at: new Date(),
            }),
          },
        });
      });
      jest.spyOn(audit, 'record').mockResolvedValue({} as any);

      await expect(service.delete('pr-1', mockUserId)).resolves.not.toThrow();
    });

    it('should reject delete if PR is not in DRAFT status', async () => {
      jest.spyOn(service, 'findById').mockResolvedValue({
        ...mockExistingPR,
        status: 'SUBMITTED',
      });

      await expect(service.delete('pr-1', mockUserId)).rejects.toThrow(BusinessRuleException);
    });

    it('should reject if PR not found', async () => {
      jest.spyOn(service, 'findById').mockResolvedValue(null);

      await expect(service.delete('non-existent', mockUserId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('search', () => {
    it('should return paginated purchase requests', async () => {
      const mockPRs = [
        {
          id: '550e8400-e29b-41d4-a716-446655440007',
          pr_number: 'PR-202501-00001',
          branch_id: '550e8400-e29b-41d4-a716-446655440000',
          warehouse_id: '550e8400-e29b-41d4-a716-446655440001',
          status: 'DRAFT',
          requested_by: mockUserId,
          notes: 'Test 1',
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
          lines: [],
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440008',
          pr_number: 'PR-202501-00002',
          branch_id: '550e8400-e29b-41d4-a716-446655440000',
          warehouse_id: '550e8400-e29b-41d4-a716-446655440001',
          status: 'DRAFT',
          requested_by: mockUserId,
          notes: 'Test 2',
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
          lines: [],
        },
      ];

      jest.spyOn(prisma.purchaseRequest, 'findMany').mockResolvedValue(mockPRs as any);
      jest.spyOn(prisma.purchaseRequest, 'count').mockResolvedValue(2);

      const result = await service.search({ page: 1, per_page: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(result.meta.page).toBe(1);
      expect(result.meta.per_page).toBe(20);
    });

    it('should filter by branch_id', async () => {
      jest.spyOn(prisma.purchaseRequest, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.purchaseRequest, 'count').mockResolvedValue(0);

      await service.search({ branch_id: '550e8400-e29b-41d4-a716-446655440000' });

      expect(prisma.purchaseRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            branch_id: '550e8400-e29b-41d4-a716-446655440000',
          }),
        }),
      );
    });

    it('should filter by status', async () => {
      jest.spyOn(prisma.purchaseRequest, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.purchaseRequest, 'count').mockResolvedValue(0);

      await service.search({ status: 'DRAFT' });

      expect(prisma.purchaseRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'DRAFT',
          }),
        }),
      );
    });
  });
});
