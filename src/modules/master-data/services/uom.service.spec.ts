import { Test, TestingModule } from '@nestjs/testing';
import { UOMService } from './uom.service';
import { PrismaService } from '../../../config/prisma.service';
import { BusinessRuleException } from '../../../common/exceptions/business-rule.exception';
import { UUID } from '../../../common/types/uuid.type';

describe('UOMService', () => {
  let service: UOMService;

  const mockUOM = {
    id: '11111111-1111-1111-1111-111111111111' as UUID,
    code: 'PCS',
    name: 'Pieces',
    symbol: 'pcs',
    is_active: true,
  };

  const mockPrisma = {
    unitOfMeasure: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UOMService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<UOMService>(UOMService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all active UOMs ordered by name', async () => {
      mockPrisma.unitOfMeasure.findMany.mockResolvedValue([mockUOM]);
      const result = await service.findAll();
      expect(result).toEqual([mockUOM]);
      expect(mockPrisma.unitOfMeasure.findMany).toHaveBeenCalledWith({
        where: { is_active: true },
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('findById', () => {
    it('should return UOM by ID', async () => {
      mockPrisma.unitOfMeasure.findUnique.mockResolvedValue(mockUOM);
      const result = await service.findById(mockUOM.id);
      expect(result).toEqual(mockUOM);
    });

    it('should throw NOT_FOUND if UOM does not exist', async () => {
      mockPrisma.unitOfMeasure.findUnique.mockResolvedValue(null);
      await expect(service.findById(mockUOM.id)).rejects.toThrow(BusinessRuleException);
    });
  });

  describe('create', () => {
    it('should create a new UOM when code is unique', async () => {
      mockPrisma.unitOfMeasure.findUnique.mockResolvedValue(null);
      mockPrisma.unitOfMeasure.create.mockResolvedValue(mockUOM);

      const result = await service.create({
        code: 'PCS',
        name: 'Pieces',
        symbol: 'pcs',
      });

      expect(result).toEqual(mockUOM);
      expect(mockPrisma.unitOfMeasure.create).toHaveBeenCalledWith({
        data: {
          code: 'PCS',
          name: 'Pieces',
          symbol: 'pcs',
          is_active: true,
        },
      });
    });

    it('should reject duplicate code', async () => {
      mockPrisma.unitOfMeasure.findUnique.mockResolvedValue(mockUOM);
      await expect(
        service.create({ code: 'PCS', name: 'Pieces', symbol: 'pcs' }),
      ).rejects.toThrow(BusinessRuleException);
    });
  });
});
