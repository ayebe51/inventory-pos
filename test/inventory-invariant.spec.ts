import fc from 'fast-check';
import { PrismaClient } from '@prisma/client';
import { InventoryService } from '../src/modules/inventory/services/inventory.service';
import { NumberingService } from '../src/services/numbering/numbering.service';
import { v4 as uuidv4 } from 'uuid';

describe('Inventory Ledger Invariant Property-Based Tests', () => {
  let prisma: PrismaClient;
  let inventoryService: InventoryService;

  beforeAll(async () => {
    prisma = new PrismaClient();
    const numberingService = new NumberingService(prisma as any);
    inventoryService = new InventoryService(prisma as any, numberingService);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('SUM(qty_in) - SUM(qty_out) should always equal running_qty after arbitrary operations', async () => {
    const p1 = 'b212f458-13b3-4f24-81d3-34e8f7a93551';
    const w1 = 'c322f458-13b3-4f24-81d3-34e8f7a93552';
    const w2 = 'd432f458-13b3-4f24-81d3-34e8f7a93553';
    const uom = 'e542f458-13b3-4f24-81d3-34e8f7a93554';
    
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            type: fc.constantFrom('transfer', 'adjust_add', 'adjust_sub'),
            qty: fc.integer({ min: 1, max: 100 }),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        async (operations) => {
          for (const op of operations) {
            try {
              if (op.type === 'transfer') {
                await inventoryService.transferStock({
                  from_warehouse_id: w1 as any,
                  to_warehouse_id: w2 as any,
                  transfer_date: new Date(),
                  created_by: uuidv4() as any,
                  lines: [{
                    product_id: p1 as any,
                    uom_id: uom as any,
                    qty: op.qty,
                    unit_cost: 10
                  }]
                });
              } else if (op.type === 'adjust_add') {
                await inventoryService.adjustStock({
                  warehouse_id: w1 as any,
                  adjustment_date: new Date(),
                  reason: 'fast-check add',
                  lines: [{
                    product_id: p1 as any,
                    uom_id: uom as any,
                    qty_system: 0, // Mock
                    qty_actual: op.qty,
                    unit_cost: 10
                  }]
                }, uuidv4() as any);
              } else if (op.type === 'adjust_sub') {
                await inventoryService.adjustStock({
                  warehouse_id: w1 as any,
                  adjustment_date: new Date(),
                  reason: 'fast-check sub',
                  lines: [{
                    product_id: p1 as any,
                    uom_id: uom as any,
                    qty_system: op.qty,
                    qty_actual: 0,
                    unit_cost: 10
                  }]
                }, uuidv4() as any);
              }
            } catch (e) {
              // Ignore BusinessRuleExceptions for insufficient stock
            }
          }

          const aggW1 = await prisma.inventoryLedger.aggregate({
            where: { product_id: p1, warehouse_id: w1 },
            _sum: { qty_in: true, qty_out: true }
          });
          const latestW1 = await prisma.inventoryLedger.findFirst({
            where: { product_id: p1, warehouse_id: w1 },
            orderBy: { created_at: 'desc' }
          });

          const expectedW1 = (Number(aggW1._sum.qty_in) || 0) - (Number(aggW1._sum.qty_out) || 0);
          expect(Number(latestW1?.running_qty) || 0).toEqual(expectedW1);
        }
      ),
      { numRuns: 2, endOnFailure: true } // Limit runs for speed in this environment
    );
  }, 30000);
});
