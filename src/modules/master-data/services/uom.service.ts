import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma.service';
import { BusinessRuleException } from '../../../common/exceptions/business-rule.exception';
import { ErrorCode } from '../../../common/enums/error-codes.enum';
import { UUID } from '../../../common/types/uuid.type';

export interface CreateUOMDTO {
  code: string;
  name: string;
  symbol: string;
}

export interface UpdateUOMDTO {
  name?: string;
  symbol?: string;
  is_active?: boolean;
}

@Injectable()
export class UOMService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.unitOfMeasure.findMany({
      where: { is_active: true },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: UUID) {
    const uom = await this.prisma.unitOfMeasure.findUnique({
      where: { id },
    });
    if (!uom) {
      throw new BusinessRuleException(`UOM with ID ${id} not found`, ErrorCode.NOT_FOUND);
    }
    return uom;
  }

  async create(data: CreateUOMDTO) {
    const existing = await this.prisma.unitOfMeasure.findUnique({
      where: { code: data.code },
    });
    if (existing) {
      throw new BusinessRuleException(
        `UOM with code ${data.code} already exists`,
        ErrorCode.CONFLICT,
      );
    }

    return this.prisma.unitOfMeasure.create({
      data: {
        code: data.code,
        name: data.name,
        symbol: data.symbol,
        is_active: true,
      },
    });
  }

  async update(id: UUID, data: UpdateUOMDTO) {
    await this.findById(id);
    return this.prisma.unitOfMeasure.update({
      where: { id },
      data,
    });
  }

  async delete(id: UUID) {
    await this.findById(id);
    return this.prisma.unitOfMeasure.update({
      where: { id },
      data: { is_active: false },
    });
  }
}
