import { z } from 'zod';

// ── CreatePriceListDTO ────────────────────────────────────────────────────────

export const CreatePriceListSchema = z.object({
  code: z.string().min(1, 'Kode price list wajib diisi').max(50, 'Kode price list maksimal 50 karakter'),
  name: z.string().min(1, 'Nama price list wajib diisi').max(200, 'Nama price list maksimal 200 karakter'),
  customer_id: z.string().uuid('customer_id harus berupa UUID').nullable().optional(),
  valid_from: z.coerce.date(),
  valid_to: z.coerce.date().nullable().optional(),
  is_active: z.boolean().default(true),
});

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePriceListDTO {
  @ApiProperty({ example: 'PL-001' })
  code!: string;

  @ApiProperty({ example: 'Harga Eceran' })
  name!: string;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000' })
  customer_id?: string | null;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  valid_from!: Date;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.000Z' })
  valid_to?: Date | null;

  @ApiPropertyOptional({ example: true })
  is_active?: boolean;
}

// ── UpdatePriceListDTO ────────────────────────────────────────────────────────

export const UpdatePriceListSchema = CreatePriceListSchema.partial();

export class UpdatePriceListDTO {
  @ApiPropertyOptional({ example: 'PL-001' })
  code?: string;

  @ApiPropertyOptional({ example: 'Harga Eceran' })
  name?: string;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000' })
  customer_id?: string | null;

  @ApiPropertyOptional({ example: '2026-01-01T00:00:00.000Z' })
  valid_from?: Date;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.000Z' })
  valid_to?: Date | null;

  @ApiPropertyOptional({ example: true })
  is_active?: boolean;
}

// ── PriceItemDTO ──────────────────────────────────────────────────────────────

export const PriceItemSchema = z.object({
  product_id: z.string().uuid('product_id harus berupa UUID'),
  unit_price: z.number().min(0, 'Harga tidak boleh negatif'),
});

export class PriceItemDTO {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  product_id!: string;

  @ApiProperty({ example: 50000 })
  unit_price!: number;
}

// ── UpdatePricesDTO ───────────────────────────────────────────────────────────

export const UpdatePricesSchema = z.object({
  items: z.array(PriceItemSchema).min(1, 'Minimal satu item harga wajib diisi'),
});

export class UpdatePricesDTO {
  @ApiProperty({ type: [PriceItemDTO] })
  items!: PriceItemDTO[];
}

// ── PriceListFilterDTO ────────────────────────────────────────────────────────

export const PriceListFilterSchema = z.object({
  customer_id: z.string().uuid().nullable().optional(),
  is_active: z.boolean().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
});

export class PriceListFilterDTO {
  @ApiPropertyOptional()
  customer_id?: string | null;

  @ApiPropertyOptional()
  is_active?: boolean;

  @ApiPropertyOptional()
  search?: string;

  @ApiPropertyOptional({ default: 1 })
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  per_page?: number;
}
