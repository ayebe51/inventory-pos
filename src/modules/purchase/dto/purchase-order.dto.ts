import { z } from 'zod';

// ── Zod Schemas ───────────────────────────────────────────────────────────────

export const CreatePOLineSchema = z.object({
  product_id: z.string().uuid(),
  qty_ordered: z.number().positive(),
  uom_id: z.string().uuid(),
  unit_price: z.number().nonnegative(),
  discount_pct: z.number().min(0).max(100).optional().default(0),
  tax_pct: z.number().min(0).max(100).optional().default(11), // Default PPN 11%
  description: z.string().optional(),
});

export const CreatePOSchema = z.object({
  pr_id: z.string().uuid().optional(),
  supplier_id: z.string().uuid(),
  branch_id: z.string().uuid(),
  warehouse_id: z.string().uuid(),
  order_date: z.coerce.date(),
  expected_delivery_date: z.coerce.date().optional(),
  currency: z.string().default('IDR'),
  exchange_rate: z.number().positive().default(1),
  additional_cost: z.number().nonnegative().optional().default(0),
  notes: z.string().optional(),
  lines: z.array(CreatePOLineSchema).min(1),
});

export const GoodsReceiptLineSchema = z.object({
  po_line_id: z.string().uuid(),
  product_id: z.string().uuid(),
  qty_received: z.number().positive(),
  uom_id: z.string().uuid(),
  unit_cost: z.number().nonnegative(),
  batch_number: z.string().optional(),
  serial_number: z.string().optional(),
  notes: z.string().optional(),
});

export const GoodsReceiptSchema = z.object({
  receipt_date: z.coerce.date(),
  notes: z.string().optional(),
  lines: z.array(GoodsReceiptLineSchema).min(1),
});

export const PurchaseOrderFilterSchema = z.object({
  branch_id: z.string().uuid().optional(),
  warehouse_id: z.string().uuid().optional(),
  supplier_id: z.string().uuid().optional(),
  status: z
    .enum([
      'DRAFT',
      'PENDING_APPROVAL',
      'APPROVED',
      'REJECTED',
      'PARTIALLY_RECEIVED',
      'FULLY_RECEIVED',
      'CANCELLED',
      'CLOSED',
    ])
    .optional(),
  created_by: z.string().uuid().optional(),
  page: z.number().int().positive().optional(),
  per_page: z.number().int().positive().max(100).optional(),
});

// ── TypeScript Types ──────────────────────────────────────────────────────────

export type CreatePOLineDTO = z.infer<typeof CreatePOLineSchema>;
export type CreatePODTO = z.infer<typeof CreatePOSchema>;
export type GoodsReceiptLineDTO = z.infer<typeof GoodsReceiptLineSchema>;
export type GoodsReceiptDTO = z.infer<typeof GoodsReceiptSchema>;
export type PurchaseOrderFilter = z.infer<typeof PurchaseOrderFilterSchema>;
