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
  branch_id: z.string().uuid().optional(),
  warehouse_id: z.string().uuid().optional(),
  notes: z.string().optional(),
  lines: z.array(CreatePurchaseRequestLineSchema).optional(),
});

export const PurchaseRequestFilterSchema = z.object({
  pr_number: z.string().optional(),
  branch_id: z.string().uuid().optional(),
  warehouse_id: z.string().uuid().optional(),
  status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED']).optional(),
  requested_by: z.string().uuid().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
  page: z.coerce.number().int().positive().optional(),
  per_page: z.coerce.number().int().positive().max(100).optional(),
});

// ── TypeScript Types ──────────────────────────────────────────────────────────

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePurchaseRequestLineDTO {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  product_id!: string;

  @ApiProperty({ example: 10 })
  qty_requested!: number;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  uom_id!: string;

  @ApiPropertyOptional({ example: 50000 })
  estimated_price?: number;

  @ApiPropertyOptional({ example: 'Mohon segera diproses' })
  notes?: string;
}

export class CreatePurchaseRequestDTO {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  branch_id!: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  warehouse_id!: string;

  @ApiPropertyOptional({ example: 'Pesanan untuk proyek A' })
  notes?: string;

  @ApiProperty({ type: [CreatePurchaseRequestLineDTO] })
  lines!: CreatePurchaseRequestLineDTO[];
}

export class UpdatePurchaseRequestDTO {
  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000' })
  branch_id?: string;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000' })
  warehouse_id?: string;

  @ApiPropertyOptional({ example: 'Pesanan untuk proyek A' })
  notes?: string;

  @ApiPropertyOptional({ type: [CreatePurchaseRequestLineDTO] })
  lines?: CreatePurchaseRequestLineDTO[];
}

export class PurchaseRequestFilter {
  @ApiPropertyOptional()
  pr_number?: string;

  @ApiPropertyOptional()
  branch_id?: string;

  @ApiPropertyOptional()
  warehouse_id?: string;

  @ApiPropertyOptional({ enum: ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED'] })
  status?: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

  @ApiPropertyOptional()
  requested_by?: string;

  @ApiPropertyOptional()
  date_from?: string;

  @ApiPropertyOptional()
  date_to?: string;

  @ApiPropertyOptional({ default: 1 })
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  per_page?: number;
}

/**
 * DTO for searching Purchase Requests
 */
export class SearchPurchaseRequestDTO {
  @ApiPropertyOptional()
  pr_number?: string;

  @ApiPropertyOptional()
  branch_id?: UUID;

  @ApiPropertyOptional()
  warehouse_id?: UUID;

  @ApiPropertyOptional()
  status?: string;

  @ApiPropertyOptional()
  requested_by?: UUID;

  @ApiPropertyOptional()
  date_from?: string;

  @ApiPropertyOptional()
  date_to?: string;

  @ApiPropertyOptional()
  page?: number;

  @ApiPropertyOptional()
  per_page?: number;
}
