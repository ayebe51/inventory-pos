import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma.service';
import { NumberingService, DocumentType } from '../../../services/numbering/numbering.service';
import { InventoryService } from './inventory.service';
import { BusinessRuleException } from '../../../common/exceptions/business-rule.exception';
import { ErrorCode } from '../../../common/enums/error-codes.enum';
import {
  StockOpnameService as IStockOpnameService,
  StockOpname,
  StockAdjustment,
  CountItem,
} from '../interfaces/inventory.interfaces';
import { UUID } from '../../../common/types/uuid.type';

@Injectable()
export class StockOpnameService implements IStockOpnameService {
  private readonly logger = new Logger(StockOpnameService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly numberingService: NumberingService,
    private readonly inventoryService: InventoryService,
  ) {}

  async findAll(): Promise<StockOpname[]> {
    const records = await this.prisma.stockOpname.findMany({
      orderBy: { created_at: 'desc' },
    });
    // Transform Prisma model to interface format
    return records.map(r => ({
      id: r.id as UUID,
      opname_number: r.opname_number,
      warehouse_id: r.warehouse_id as UUID,
      status: r.status as any,
      initiated_by: r.initiated_by as UUID,
      initiated_at: r.initiated_at,
      completed_at: r.finalized_at || null,
      created_at: r.created_at,
      updated_at: r.updated_at,
      lines: []
    }));
  }

  async initiate(warehouseId: UUID, userId: UUID): Promise<StockOpname> {
    this.logger.log(`Initiating stock opname for warehouse ${warehouseId}`);
    
    return await this.prisma.$transaction(async (tx) => {
      const warehouse = await tx.warehouse.findUnique({
        where: { id: warehouseId },
      });

      if (!warehouse) {
        throw new BusinessRuleException('Warehouse not found', ErrorCode.NOT_FOUND);
      }
      if (warehouse.is_locked) {
        throw new BusinessRuleException('Warehouse is already locked', ErrorCode.BUSINESS_RULE_VIOLATION);
      }

      // Lock the warehouse (BR-INV-005)
      await tx.warehouse.update({
        where: { id: warehouseId },
        data: {
          is_locked: true,
          lock_reason: 'STOCK_OPNAME',
          locked_at: new Date(),
          locked_by: userId,
        }
      });

      const opnameNumber = await this.numberingService.generate(DocumentType.SOP);

      // Get all current stock balances for this warehouse
      const ledgers = await tx.inventoryLedger.groupBy({
        by: ['product_id'],
        where: { warehouse_id: warehouseId },
        _sum: { qty_in: true, qty_out: true },
      });

      const lines = ledgers.map(l => {
        const qty_in = Number(l._sum.qty_in) || 0;
        const qty_out = Number(l._sum.qty_out) || 0;
        return {
          product_id: l.product_id,
          qty_system: qty_in - qty_out,
        };
      }).filter(l => l.qty_system > 0);

      const opname = await tx.stockOpname.create({
        data: {
          opname_number: opnameNumber,
          warehouse_id: warehouseId,
          status: 'INITIATED',
          initiated_by: userId,
          initiated_at: new Date(),
          lines: {
            create: lines.map(l => ({
              product_id: l.product_id,
              qty_system: l.qty_system,
              status: 'PENDING',
            }))
          }
        },
        include: { lines: true },
      });

      return opname as any;
    });
  }

  async recordCount(opnameId: UUID, items: CountItem[]): Promise<void> {
    this.logger.log(`Recording count for opname ${opnameId}`);
    await this.prisma.$transaction(async (tx) => {
      const opname = await tx.stockOpname.findUnique({
        where: { id: opnameId },
        include: { lines: true }
      });

      if (!opname) throw new BusinessRuleException('Stock opname not found', ErrorCode.NOT_FOUND);
      if (opname.status === 'COMPLETED') throw new BusinessRuleException('Stock opname already completed', ErrorCode.BUSINESS_RULE_VIOLATION);

      // Update status to IN_PROGRESS if INITIATED
      if (opname.status === 'INITIATED') {
        await tx.stockOpname.update({
          where: { id: opnameId },
          data: { status: 'IN_PROGRESS' }
        });
      }

      for (const item of items) {
        const line = opname.lines.find(l => l.product_id === item.product_id);
        
        if (line) {
          await tx.stockOpnameLine.update({
            where: { id: line.id },
            data: {
              qty_counted: item.qty_counted,
              qty_difference: item.qty_counted - Number(line.qty_system),
              status: 'COUNTED'
            }
          });
        } else {
          // Found an item not originally in the system for this warehouse
          await tx.stockOpnameLine.create({
            data: {
              opname_id: opnameId,
              product_id: item.product_id,
              qty_system: 0,
              qty_counted: item.qty_counted,
              qty_difference: item.qty_counted,
              status: 'COUNTED'
            }
          });
        }
      }
    });
  }

  async requestRecount(opnameId: UUID, productIds: UUID[]): Promise<void> {
    this.logger.log(`Requesting recount for opname ${opnameId}`);
    await this.prisma.stockOpnameLine.updateMany({
      where: {
        opname_id: opnameId,
        product_id: { in: productIds }
      },
      data: {
        status: 'PENDING',
        recount_reason: 'Recount requested'
      }
    });
  }

  async finalize(opnameId: UUID, userId: UUID): Promise<StockAdjustment> {
    this.logger.log(`Finalizing opname ${opnameId}`);
    
    // Check pending lines before transaction
    const opnameCheck = await this.prisma.stockOpname.findUnique({
      where: { id: opnameId },
      include: { lines: true }
    });

    if (!opnameCheck) throw new BusinessRuleException('Stock opname not found', ErrorCode.NOT_FOUND);
    if (opnameCheck.status === 'COMPLETED') throw new BusinessRuleException('Stock opname already completed', ErrorCode.BUSINESS_RULE_VIOLATION);

    const pendingLines = opnameCheck.lines.filter(l => l.status === 'PENDING');
    if (pendingLines.length > 0) {
      throw new BusinessRuleException('Cannot finalize opname with PENDING lines. All items must be COUNTED.', ErrorCode.VALIDATION_ERROR);
    }

    const discrepancyLines = opnameCheck.lines.filter(l => l.qty_difference && Number(l.qty_difference) !== 0);
    let adjustment: StockAdjustment | null = null;
    
    if (discrepancyLines.length > 0) {
      // Need to create adjustment
      const adjustmentLines = await Promise.all(discrepancyLines.map(async (l) => {
        // get the unit cost from product or latest ledger
        const latest = await this.prisma.inventoryLedger.findFirst({
          where: { product_id: l.product_id, warehouse_id: opnameCheck.warehouse_id },
          orderBy: { created_at: 'desc' }
        });
        const product = await this.prisma.product.findUnique({ where: { id: l.product_id } });
        
        let unitCost = 0;
        if (latest && Number(latest.running_qty) > 0) {
          unitCost = Number(latest.running_cost) / Number(latest.running_qty);
        } else if (product) {
          unitCost = Number(product.standard_cost);
        }

        return {
          product_id: l.product_id,
          uom_id: product!.uom_id,
          qty_system: Number(l.qty_system),
          qty_actual: Number(l.qty_counted),
          unit_cost: unitCost,
        };
      }));

      // We call inventoryService.adjustStock outside of our transaction because adjustStock uses its own transaction
      adjustment = await this.inventoryService.adjustStock({
        warehouse_id: opnameCheck.warehouse_id,
        adjustment_date: new Date(),
        reason: `Stock Opname ${opnameCheck.opname_number}`,
        lines: adjustmentLines,
      }, userId);
    }

    // After adjustStock succeeds, mark as completed and unlock
    await this.prisma.$transaction(async (tx) => {
      // Mark opname as completed
      await tx.stockOpname.update({
        where: { id: opnameId },
        data: {
          status: 'COMPLETED',
          finalized_by: userId,
          finalized_at: new Date()
        }
      });

      // Unlock warehouse
      await tx.warehouse.update({
        where: { id: opnameCheck.warehouse_id },
        data: {
          is_locked: false,
          lock_reason: null,
          locked_at: null,
          locked_by: null,
        }
      });
    });

    return adjustment as any;
  }
}
