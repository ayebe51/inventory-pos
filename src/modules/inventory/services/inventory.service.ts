import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma.service';
import { BusinessRuleException } from '../../../common/exceptions/business-rule.exception';
import { ErrorCode } from '../../../common/enums/error-codes.enum';
import {
  InventoryService as IInventoryService,
  InventoryLedgerEntry,
  StockMovementDTO,
  StockBalance,
  StockTransferDTO,
  StockTransfer,
  StockAdjustmentDTO,
  StockAdjustment,
} from '../interfaces/inventory.interfaces';
import { UUID } from '../../../common/types/uuid.type';
import { DocumentType, NumberingService } from '../../../services/numbering/numbering.service';

@Injectable()
export class InventoryService implements IInventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly numberingService: NumberingService,
  ) {}

  /**
   * Record inventory movement with append-only insert to inventory_ledger
   * Implements BR-INV-002: No UPDATE/DELETE allowed on inventory ledger
   * Implements BR-INV-001: Negative stock check
   *
   * @param data Stock movement data
   * @returns Created inventory ledger entry
   * @throws BusinessRuleException if validation fails
   * @throws InsufficientStockException if balance would become negative (BR-INV-001)
   */
  async recordMovement(data: StockMovementDTO): Promise<InventoryLedgerEntry> {
    this.logger.log(
      `Recording inventory movement: ${data.transaction_type} for product ${data.product_id} in warehouse ${data.warehouse_id}`,
    );

    // Validate input
    this.validateMovementData(data);

    // Calculate running balance and cost
    const { running_qty, running_cost, average_cost } =
      await this.calculateRunningBalance(
        data.product_id,
        data.warehouse_id,
        data.qty_in,
        data.qty_out,
        data.unit_cost,
      );

    // BR-INV-001: Negative stock check
    // Reject transaction if balance would become negative
    if (running_qty < 0) {
      this.logger.warn(
        `BR-INV-001 violation: Insufficient stock for product ${data.product_id} in warehouse ${data.warehouse_id}. ` +
          `Current balance would be: ${running_qty}`,
      );
      throw new BusinessRuleException(
        `Insufficient stock for product ${data.product_id} in warehouse ${data.warehouse_id}. ` +
          `Transaction would result in negative balance: ${running_qty}`,
        ErrorCode.INSUFFICIENT_STOCK,
      );
    }

    // Calculate total cost for this movement
    const total_cost = data.qty_in > 0 ? data.qty_in * data.unit_cost : 0;

    // Append-only insert to inventory_ledger
    // BR-INV-002: No UPDATE or DELETE operations allowed
    const ledgerEntry = await this.prisma.inventoryLedger.create({
      data: {
        product_id: data.product_id,
        warehouse_id: data.warehouse_id,
        transaction_type: data.transaction_type,
        reference_type: data.reference_type,
        reference_id: data.reference_id,
        reference_number: data.reference_number,
        movement_date: data.movement_date,
        qty_in: data.qty_in,
        qty_out: data.qty_out,
        unit_cost: data.unit_cost,
        total_cost: total_cost,
        running_qty: running_qty,
        running_cost: running_cost,
        batch_number: null, // TODO: Implement batch tracking
        serial_number: null, // TODO: Implement serial tracking
        notes: data.notes || null,
        created_by: data.created_by,
      },
    });

    this.logger.log(
      `Inventory movement recorded: ${ledgerEntry.id}, running_qty: ${running_qty}, running_cost: ${running_cost}`,
    );

    return this.mapToInventoryLedgerEntry(ledgerEntry);
  }

  /**
   * Get current stock balance for a product in a warehouse
   * Calculates balance from inventory ledger: SUM(qty_in) - SUM(qty_out)
   * Implements the core formula: balance = SUM(qty_in) - SUM(qty_out) per (product_id, warehouse_id)
   *
   * @param productId Product UUID
   * @param warehouseId Warehouse UUID
   * @returns Stock balance with quantities and average cost
   */
  async getStockBalance(
    productId: UUID,
    warehouseId: UUID,
  ): Promise<StockBalance> {
    this.logger.log(
      `Getting stock balance for product ${productId} in warehouse ${warehouseId}`,
    );

    // Aggregate qty_in and qty_out from inventory_ledger
    // This is the canonical source of truth for stock balance
    const aggregateResult = await this.prisma.inventoryLedger.aggregate({
      where: {
        product_id: productId,
        warehouse_id: warehouseId,
      },
      _sum: {
        qty_in: true,
        qty_out: true,
      },
    });

    // Calculate balance: SUM(qty_in) - SUM(qty_out)
    const totalQtyIn = aggregateResult._sum.qty_in
      ? Number(aggregateResult._sum.qty_in)
      : 0;
    const totalQtyOut = aggregateResult._sum.qty_out
      ? Number(aggregateResult._sum.qty_out)
      : 0;
    const balance = totalQtyIn - totalQtyOut;

    // Get the latest ledger entry to retrieve running_cost for average cost calculation
    const latestEntry = await this.prisma.inventoryLedger.findFirst({
      where: {
        product_id: productId,
        warehouse_id: warehouseId,
      },
      orderBy: {
        created_at: 'desc',
      },
      select: {
        running_qty: true,
        running_cost: true,
      },
    });

    // Calculate average cost and total value
    const runningQty = latestEntry?.running_qty
      ? Number(latestEntry.running_qty)
      : 0;
    const runningCost = latestEntry?.running_cost
      ? Number(latestEntry.running_cost)
      : 0;

    // Average cost = total value / total quantity
    const averageCost = runningQty > 0 ? runningCost / runningQty : 0;
    const totalValue = balance * averageCost;

    // For now, all stock is considered AVAILABLE
    // Status tracking (RESERVED, COMMITTED, etc.) will be implemented in task 10.8
    const stockBalance: StockBalance = {
      product_id: productId,
      warehouse_id: warehouseId,
      qty_available: balance,
      qty_reserved: 0,
      qty_committed: 0,
      qty_damaged: 0,
      qty_quarantine: 0,
      qty_in_transit: 0,
      average_cost: Math.max(0, averageCost), // Ensure non-negative (BR-INV-003)
      total_value: Math.max(0, totalValue), // Ensure non-negative
    };

    this.logger.log(
      `Stock balance calculated: qty_available=${balance}, average_cost=${averageCost.toFixed(4)}, total_value=${totalValue.toFixed(2)}`,
    );

    return stockBalance;
  }

  /**
   * Transfer stock between warehouses
   *
   * @param data Stock transfer data
   * @returns Created stock transfer
   */
  async transferStock(data: StockTransferDTO): Promise<StockTransfer> {
    this.logger.log(
      `Transferring stock from ${data.from_warehouse_id} to ${data.to_warehouse_id}`,
    );

    if (data.from_warehouse_id === data.to_warehouse_id) {
      throw new BusinessRuleException(
        'Source and destination warehouse cannot be the same',
        ErrorCode.VALIDATION_ERROR,
      );
    }

    let lastError: any;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const transferNumber = await this.numberingService.generate(DocumentType.TO, data.transfer_date);

        return await this.prisma.$transaction(async (tx) => {
          const sourceWarehouse = await tx.warehouse.findUnique({
            where: { id: data.from_warehouse_id },
          });
          const destWarehouse = await tx.warehouse.findUnique({
            where: { id: data.to_warehouse_id },
          });

          if (sourceWarehouse?.is_locked) {
            throw new BusinessRuleException(`Source warehouse locked`, ErrorCode.BUSINESS_RULE_VIOLATION);
          }
          if (destWarehouse?.is_locked) {
            throw new BusinessRuleException(`Destination warehouse locked`, ErrorCode.BUSINESS_RULE_VIOLATION);
          }

          const productIds = Array.from(new Set(data.lines.map((l) => l.product_id)));
          productIds.sort();
          for (const productId of productIds) {
            await tx.$queryRawUnsafe(`SELECT id FROM products WHERE id = $1::uuid FOR UPDATE NOWAIT`, productId);
          }

          const transfer = await tx.stockTransfer.create({
            data: {
              transfer_number: transferNumber,
              from_warehouse_id: data.from_warehouse_id,
              to_warehouse_id: data.to_warehouse_id,
              status: 'COMPLETED',
              transfer_date: data.transfer_date,
              created_by: data.created_by,
              lines: {
                create: data.lines.map((l) => ({
                  product_id: l.product_id,
                  qty: l.qty,
                  uom_id: l.uom_id,
                  unit_cost: l.unit_cost,
                })),
              },
            },
            include: { lines: true },
          });

          for (const line of data.lines) {
            const aggSource = await tx.inventoryLedger.aggregate({
              where: { product_id: line.product_id, warehouse_id: data.from_warehouse_id },
              _sum: { qty_in: true, qty_out: true },
            });
            const srcQty = (Number(aggSource._sum.qty_in) || 0) - (Number(aggSource._sum.qty_out) || 0);

            if (srcQty < line.qty) {
              throw new BusinessRuleException(`Insufficient stock for product ${line.product_id}`, ErrorCode.INSUFFICIENT_STOCK);
            }

            const latestSrc = await tx.inventoryLedger.findFirst({
              where: { product_id: line.product_id, warehouse_id: data.from_warehouse_id },
              orderBy: { created_at: 'desc' },
            });
            const srcRunningCost = Number(latestSrc?.running_cost) || 0;
            const srcRunningQty = Number(latestSrc?.running_qty) || 0;
            const srcUnitCost = srcRunningQty > 0 ? srcRunningCost / srcRunningQty : 0;
            
            const srcNewQty = srcQty - line.qty;
            const srcNewCost = srcRunningCost - line.qty * srcUnitCost;

            const aggDest = await tx.inventoryLedger.aggregate({
              where: { product_id: line.product_id, warehouse_id: data.to_warehouse_id },
              _sum: { qty_in: true, qty_out: true },
            });
            const destQty = (Number(aggDest._sum.qty_in) || 0) - (Number(aggDest._sum.qty_out) || 0);

            const latestDest = await tx.inventoryLedger.findFirst({
              where: { product_id: line.product_id, warehouse_id: data.to_warehouse_id },
              orderBy: { created_at: 'desc' },
            });
            const destRunningCost = Number(latestDest?.running_cost) || 0;
            const destNewQty = destQty + line.qty;
            const destNewCost = destRunningCost + line.qty * srcUnitCost;

            if (srcNewQty + destNewQty !== srcQty + destQty) {
              throw new Error("Invariant violated: Total stock changed!");
            }

            await tx.inventoryLedger.create({
              data: {
                product_id: line.product_id,
                warehouse_id: data.from_warehouse_id,
                transaction_type: 'TRANSFER_OUT',
                reference_type: 'TO',
                reference_id: transfer.id,
                reference_number: transfer.transfer_number,
                movement_date: data.transfer_date,
                qty_in: 0,
                qty_out: line.qty,
                unit_cost: srcUnitCost,
                total_cost: line.qty * srcUnitCost,
                running_qty: srcNewQty,
                running_cost: Math.max(0, srcNewCost),
                created_by: data.created_by,
              },
            });

            await tx.inventoryLedger.create({
              data: {
                product_id: line.product_id,
                warehouse_id: data.to_warehouse_id,
                transaction_type: 'TRANSFER_IN',
                reference_type: 'TO',
                reference_id: transfer.id,
                reference_number: transfer.transfer_number,
                movement_date: data.transfer_date,
                qty_in: line.qty,
                qty_out: 0,
                unit_cost: srcUnitCost,
                total_cost: line.qty * srcUnitCost,
                running_qty: destNewQty,
                running_cost: Math.max(0, destNewCost),
                created_by: data.created_by,
              },
            });
          }

          return transfer as any;
        });
      } catch (err: any) {
        lastError = err;
        if (err.message && (err.message.includes('could not obtain lock') || err.message.includes('NOWAIT') || err.message.includes('deadlock'))) {
          const delay = 50 * Math.pow(2, attempt - 1);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        throw err;
      }
    }
    throw lastError;
  }

  /**
   * Adjust stock with reason
   *
   * @param data Stock adjustment data
   * @param userId User performing adjustment
   * @returns Created stock adjustment
   */
  async adjustStock(
    data: StockAdjustmentDTO,
    userId: UUID,
  ): Promise<StockAdjustment> {
    if (!data.reason) {
      throw new BusinessRuleException('Adjustment reason is required', ErrorCode.VALIDATION_ERROR);
    }

    let lastError: any;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const adjustmentNumber = await this.numberingService.generate(DocumentType.SA, data.adjustment_date);

        return await this.prisma.$transaction(async (tx) => {
          const warehouse = await tx.warehouse.findUnique({
            where: { id: data.warehouse_id },
          });

          if (warehouse?.is_locked) {
            throw new BusinessRuleException(`Warehouse locked`, ErrorCode.BUSINESS_RULE_VIOLATION);
          }

          const productIds = Array.from(new Set(data.lines.map((l) => l.product_id)));
          productIds.sort();
          for (const productId of productIds) {
            await tx.$queryRawUnsafe(`SELECT id FROM products WHERE id = $1::uuid FOR UPDATE NOWAIT`, productId);
          }

          const adjustment = await tx.stockAdjustment.create({
            data: {
              adjustment_number: adjustmentNumber,
              warehouse_id: data.warehouse_id,
              adjustment_date: data.adjustment_date,
              reason: data.reason,
              status: 'POSTED',
              created_by: userId,
              lines: {
                create: data.lines.map((l) => ({
                  product_id: l.product_id,
                  uom_id: l.uom_id,
                  qty_system: l.qty_system,
                  qty_actual: l.qty_actual,
                  qty_difference: l.qty_actual - l.qty_system,
                  unit_cost: l.unit_cost,
                })),
              },
            },
            include: { lines: true },
          });

          for (const line of data.lines) {
            const diff = line.qty_actual - line.qty_system;
            if (diff === 0) continue;

            const isPositive = diff > 0;
            const qtyIn = isPositive ? diff : 0;
            const qtyOut = isPositive ? 0 : Math.abs(diff);

            const agg = await tx.inventoryLedger.aggregate({
              where: { product_id: line.product_id, warehouse_id: data.warehouse_id },
              _sum: { qty_in: true, qty_out: true },
            });
            const currentQty = (Number(agg._sum.qty_in) || 0) - (Number(agg._sum.qty_out) || 0);

            if (!isPositive && currentQty < Math.abs(diff)) {
              throw new BusinessRuleException(`Insufficient stock for product ${line.product_id}`, ErrorCode.INSUFFICIENT_STOCK);
            }

            const latest = await tx.inventoryLedger.findFirst({
              where: { product_id: line.product_id, warehouse_id: data.warehouse_id },
              orderBy: { created_at: 'desc' },
            });
            const runningCost = Number(latest?.running_cost) || 0;
            const runningQty = Number(latest?.running_qty) || 0;
            
            const currentUnitCost = runningQty > 0 ? runningCost / runningQty : 0;
            const unitCost = isPositive ? line.unit_cost : currentUnitCost;
            
            const newQty = currentQty + diff;
            const newCost = isPositive ? runningCost + (diff * unitCost) : runningCost - (Math.abs(diff) * currentUnitCost);

            await tx.inventoryLedger.create({
              data: {
                product_id: line.product_id,
                warehouse_id: data.warehouse_id,
                transaction_type: 'ADJUSTMENT',
                reference_type: 'SA',
                reference_id: adjustment.id,
                reference_number: adjustment.adjustment_number,
                movement_date: data.adjustment_date,
                qty_in: qtyIn,
                qty_out: qtyOut,
                unit_cost: unitCost,
                total_cost: Math.abs(diff) * unitCost,
                running_qty: newQty,
                running_cost: Math.max(0, newCost),
                created_by: userId,
              },
            });
          }

          return adjustment as any;
        });
      } catch (err: any) {
        lastError = err;
        if (err.message && (err.message.includes('could not obtain lock') || err.message.includes('NOWAIT') || err.message.includes('deadlock'))) {
          const delay = 50 * Math.pow(2, attempt - 1);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        throw err;
      }
    }
    throw lastError;
  }

  /**
   * Lock warehouse (e.g., during stock opname)
   *
   * @param warehouseId Warehouse UUID
   * @param reason Reason for locking
   */
  async lockWarehouse(warehouseId: UUID, reason: string): Promise<void> {
    await this.prisma.warehouse.update({
      where: { id: warehouseId },
      data: {
        is_locked: true,
        lock_reason: reason,
        locked_at: new Date(),
      }
    });
  }

  /**
   * Calculate weighted average cost (WAC) for a product in a warehouse
   *
   * Implements the WAC algorithm from design.md:
   * 1. Get current stock balance: currentQty = SUM(qty_in - qty_out) from inventory_ledger
   * 2. Get current value: currentValue = currentQty * currentAverageCost
   * 3. Validate currentQty >= 0 (BR-INV-001)
   * 4. If incomingQty and incomingCost are provided, apply WAC formula:
   *    ROUND((currentValue + incomingCost) / (currentQty + incomingQty), 4)
   * 5. If totalQty = 0, return 0
   * 6. Ensure result >= 0 (BR-INV-003)
   *
   * Example calculation:
   * - Stok awal: 100 unit @ Rp 10.000 = Rp 1.000.000
   * - Penerimaan: 50 unit @ Rp 12.000 = Rp 600.000
   * - WAC baru: (1.000.000 + 600.000) / (100 + 50) = Rp 10.666,6667
   *
   * @param productId Product UUID
   * @param warehouseId Warehouse UUID
   * @param incomingQty Optional: quantity of incoming goods (> 0)
   * @param incomingCost Optional: total cost of incoming goods (>= 0)
   * @returns Weighted average cost rounded to 4 decimal places, >= 0
   * @throws BusinessRuleException if currentQty < 0 (BR-INV-001)
   */
  async calculateAverageCost(
    productId: UUID,
    warehouseId: UUID,
    incomingQty?: number,
    incomingCost?: number,
  ): Promise<number> {
    this.logger.log(
      `Calculating average cost for product ${productId} in warehouse ${warehouseId}`,
    );

    // Step 1: Get current stock balance from inventory_ledger
    // currentQty = SUM(qty_in) - SUM(qty_out)
    const aggregateResult = await this.prisma.inventoryLedger.aggregate({
      where: {
        product_id: productId,
        warehouse_id: warehouseId,
      },
      _sum: {
        qty_in: true,
        qty_out: true,
      },
    });

    const totalQtyIn = aggregateResult._sum.qty_in
      ? Number(aggregateResult._sum.qty_in)
      : 0;
    const totalQtyOut = aggregateResult._sum.qty_out
      ? Number(aggregateResult._sum.qty_out)
      : 0;
    const currentQty = totalQtyIn - totalQtyOut;

    // Step 3: Validate currentQty >= 0 (BR-INV-001)
    if (currentQty < 0) {
      this.logger.warn(
        `BR-INV-001 violation: Negative stock detected for product ${productId} in warehouse ${warehouseId}. ` +
          `Current balance: ${currentQty}`,
      );
      throw new BusinessRuleException(
        `Negative stock detected for product ${productId} in warehouse ${warehouseId}. ` +
          `Current balance: ${currentQty}`,
        ErrorCode.BUSINESS_RULE_VIOLATION,
      );
    }

    // Step 2: Get current value from the latest ledger entry
    // currentValue = currentQty * currentAverageCost
    const latestEntry = await this.prisma.inventoryLedger.findFirst({
      where: {
        product_id: productId,
        warehouse_id: warehouseId,
      },
      orderBy: {
        created_at: 'desc',
      },
      select: {
        running_qty: true,
        running_cost: true,
      },
    });

    const runningQty = latestEntry?.running_qty
      ? Number(latestEntry.running_qty)
      : 0;
    const runningCost = latestEntry?.running_cost
      ? Number(latestEntry.running_cost)
      : 0;

    // Calculate current average cost from running values
    const currentAverageCost = runningQty > 0 ? runningCost / runningQty : 0;
    const currentValue = currentQty * currentAverageCost;

    this.logger.debug(
      `WAC calculation: currentQty=${currentQty}, currentValue=${currentValue}, currentAverageCost=${currentAverageCost}`,
    );

    // Apply WAC formula with incoming goods if provided
    // Formula: ROUND((currentValue + incomingCost) / (currentQty + incomingQty), 4)
    const effectiveIncomingQty =
      incomingQty !== undefined && incomingQty !== null ? incomingQty : 0;
    const effectiveIncomingCost =
      incomingCost !== undefined && incomingCost !== null ? incomingCost : 0;

    const totalQty = currentQty + effectiveIncomingQty;
    const totalValue = currentValue + effectiveIncomingCost;

    // Step 5: If totalQty = 0, return 0
    if (totalQty === 0) {
      this.logger.log(
        `Average cost is 0 because total quantity is 0 for product ${productId} in warehouse ${warehouseId}`,
      );
      return 0;
    }

    // Step 4: Calculate WAC using formula
    const averageCost = totalValue / totalQty;

    // Step 6: Ensure result >= 0 (BR-INV-003)
    const roundedAverageCost = Math.round(averageCost * 10000) / 10000; // Round to 4 decimal places
    const finalAverageCost = Math.max(0, roundedAverageCost);

    this.logger.log(
      `Average cost calculated: ${finalAverageCost} for product ${productId} in warehouse ${warehouseId}`,
    );

    return finalAverageCost;
  }

  /**
   * Validate stock movement data
   *
   * @param data Stock movement data
   * @throws BusinessRuleException if validation fails
   */
  private validateMovementData(data: StockMovementDTO): void {
    // Validate quantities are non-negative
    if (data.qty_in < 0) {
      throw new BusinessRuleException(
        'qty_in must be >= 0',
        ErrorCode.VALIDATION_ERROR,
      );
    }

    if (data.qty_out < 0) {
      throw new BusinessRuleException(
        'qty_out must be >= 0',
        ErrorCode.VALIDATION_ERROR,
      );
    }

    // Validate that either qty_in or qty_out is > 0, but not both
    if (data.qty_in > 0 && data.qty_out > 0) {
      throw new BusinessRuleException(
        'Cannot have both qty_in and qty_out > 0 in the same movement',
        ErrorCode.VALIDATION_ERROR,
      );
    }

    if (data.qty_in === 0 && data.qty_out === 0) {
      throw new BusinessRuleException(
        'Either qty_in or qty_out must be > 0',
        ErrorCode.VALIDATION_ERROR,
      );
    }

    // Validate unit cost is non-negative
    if (data.unit_cost < 0) {
      throw new BusinessRuleException(
        'unit_cost must be >= 0',
        ErrorCode.VALIDATION_ERROR,
      );
    }

    // Validate movement date is not in the future
    const now = new Date();
    if (data.movement_date > now) {
      throw new BusinessRuleException(
        'movement_date cannot be in the future',
        ErrorCode.VALIDATION_ERROR,
      );
    }
  }

  /**
   * Calculate running balance and cost after this movement
   * Uses the latest ledger entry to get current state
   *
   * @param productId Product UUID
   * @param warehouseId Warehouse UUID
   * @param qtyIn Quantity in
   * @param qtyOut Quantity out
   * @param unitCost Unit cost for incoming stock
   * @returns Running quantity, running cost, and average cost
   */
  private async calculateRunningBalance(
    productId: UUID,
    warehouseId: UUID,
    qtyIn: number,
    qtyOut: number,
    unitCost: number,
  ): Promise<{
    running_qty: number;
    running_cost: number;
    average_cost: number;
  }> {
    // Get the latest ledger entry to determine current running balance
    const latestEntry = await this.prisma.inventoryLedger.findFirst({
      where: {
        product_id: productId,
        warehouse_id: warehouseId,
      },
      orderBy: {
        created_at: 'desc',
      },
      select: {
        running_qty: true,
        running_cost: true,
      },
    });

    // Convert Decimal to number
    const currentQty = latestEntry?.running_qty
      ? Number(latestEntry.running_qty)
      : 0;
    const currentValue = latestEntry?.running_cost
      ? Number(latestEntry.running_cost)
      : 0;

    // Calculate new running balance
    const newQty = currentQty + qtyIn - qtyOut;
    const incomingValue = qtyIn * unitCost;
    const outgoingValue =
      qtyOut * (currentQty > 0 ? currentValue / currentQty : 0);
    const newValue = currentValue + incomingValue - outgoingValue;

    // Calculate average cost
    const averageCost = newQty > 0 ? newValue / newQty : 0;

    return {
      running_qty: newQty,
      running_cost: Math.max(0, newValue), // Ensure non-negative
      average_cost: Math.max(0, averageCost), // Ensure non-negative (BR-INV-003)
    };
  }

  /**
   * Map Prisma inventory_ledger to InventoryLedgerEntry interface
   *
   * @param ledger Prisma inventory_ledger record
   * @returns InventoryLedgerEntry
   */
  private mapToInventoryLedgerEntry(ledger: any): InventoryLedgerEntry {
    return {
      id: ledger.id,
      product_id: ledger.product_id,
      warehouse_id: ledger.warehouse_id,
      transaction_type: ledger.transaction_type,
      reference_type: ledger.reference_type,
      reference_id: ledger.reference_id,
      reference_number: ledger.reference_number,
      movement_date: ledger.movement_date,
      qty_in: ledger.qty_in,
      qty_out: ledger.qty_out,
      unit_cost: ledger.unit_cost,
      total_cost: ledger.total_cost,
      running_qty: ledger.running_qty,
      running_cost: ledger.running_cost,
      batch_number: ledger.batch_number,
      serial_number: ledger.serial_number,
      notes: ledger.notes,
      created_by: ledger.created_by,
      created_at: ledger.created_at,
    };
  }
}
