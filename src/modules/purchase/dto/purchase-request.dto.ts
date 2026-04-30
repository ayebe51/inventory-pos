import { z } from 'zod';
import { UUID } from '../../../common/types/uuid.type';

// ── Zod Schemas ───────────────────────────────────────────────────────────────

export const CreatePurchaseRequestLineSchema = z.object({
  product_id: z.string().uuid(),
  qty_requested: z.number().positive(),
  uom_id: z.string().uuid(),
  estimated_price: z.number().nonnegative().optional(),
  notes: z.string().optional(),
});

export const CreatePurchaseRequestSchema = z.object({
  branch_id: z.string().uuid(),
  warehouse_id: z.string().uuid(),
  notes: z.string().optional(),
  lines: z.array(CreatePurchaseRequestLineSchema).min(1),
});

export const UpdatePurchaseRequestSchema = z.object({
  warehouse_id: z.string().uuid().optional(),
  notes: z.string().optional(),
  lines: z.array(CreatePurchaseRequestLineSchema).optional(),
});

export const PurchaseRequestFilterSchema = z.object({
  branch_id: z.string().uuid().optional(),
  warehouse_id: z.string().uuid().optional(),
  status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED']).optional(),
  requested_by: z.string().uuid().optional(),
  page: z.number().int().positive().optional(),
  per_page: z.number().int().positive().max(100).optional(),
});

// ── TypeScript Types ──────────────────────────────────────────────────────────

export type CreatePurchaseRequestLineDTO = z.infer<typeof CreatePurchaseRequestLineSchema>;
export type CreatePurchaseRequestDTO = z.infer<typeof CreatePurchaseRequestSchema>;
export type UpdatePurchaseRequestDTO = z.infer<typeof UpdatePurchaseRequestSchema>;
export type PurchaseRequestFilter = z.infer<typeof PurchaseRequestFilterSchema>;
