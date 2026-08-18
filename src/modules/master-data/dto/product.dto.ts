import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ── CreateProductDTO ──────────────────────────────────────────────────────────

export const CreateProductSchema = z.object({
  code: z.string().min(1, 'Kode produk wajib diisi').max(50, 'Kode produk maksimal 50 karakter'),
  barcode: z.string().max(100).nullable().optional(),
  name: z.string().min(1, 'Nama produk wajib diisi').max(200, 'Nama produk maksimal 200 karakter'),
  description: z.string().nullable().optional(),
  category_id: z.string().uuid('category_id harus berupa UUID'),
  brand_id: z.string().uuid('brand_id harus berupa UUID').nullable().optional(),
  uom_id: z.string().uuid('uom_id harus berupa UUID'),
  uom_purchase_id: z.string().uuid('uom_purchase_id harus berupa UUID').nullable().optional(),
  uom_sales_id: z.string().uuid('uom_sales_id harus berupa UUID').nullable().optional(),
  cost_method: z.enum(['WAC', 'FIFO']).default('WAC'),
  standard_cost: z.number().min(0, 'standard_cost harus >= 0').default(0),
  selling_price: z.number().min(0, 'selling_price harus >= 0').default(0),
  min_selling_price: z.number().min(0, 'min_selling_price harus >= 0').default(0),
  reorder_point: z.number().min(0).default(0),
  reorder_qty: z.number().min(0).default(0),
  max_stock: z.number().min(0).nullable().optional(),
  is_serialized: z.boolean().default(false),
  is_batch_tracked: z.boolean().default(false),
  is_active: z.boolean().default(true),
  tax_category: z.string().max(50).nullable().optional(),
  weight: z.number().min(0).nullable().optional(),
  volume: z.number().min(0).nullable().optional(),
  image_url: z.string().max(500).url('image_url harus berupa URL valid').nullable().optional(),
  notes: z.string().nullable().optional(),
});

export class CreateProductDTO {
  @ApiProperty({ example: 'PRD-001' })
  code!: string;

  @ApiPropertyOptional({ example: '1234567890123' })
  barcode?: string | null;

  @ApiProperty({ example: 'Kopi Arabica 1Kg' })
  name!: string;

  @ApiPropertyOptional({ example: 'Biji kopi pilihan' })
  description?: string | null;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  category_id!: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440001' })
  brand_id?: string | null;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440002' })
  uom_id!: string;

  @ApiProperty({ example: 'WAC', enum: ['WAC', 'FIFO'] })
  cost_method?: string = 'WAC';

  @ApiProperty({ example: 100000 })
  standard_cost?: number = 0;

  @ApiProperty({ example: 150000 })
  selling_price?: number = 0;

  @ApiPropertyOptional()
  min_selling_price?: number = 0;

  @ApiPropertyOptional()
  reorder_point?: number = 0;

  @ApiPropertyOptional()
  reorder_qty?: number = 0;

  @ApiPropertyOptional()
  max_stock?: number | null;

  @ApiPropertyOptional()
  is_serialized?: boolean = false;

  @ApiPropertyOptional()
  is_batch_tracked?: boolean = false;

  @ApiPropertyOptional()
  is_active?: boolean = true;
}

// ── UpdateProductDTO ──────────────────────────────────────────────────────────

export const UpdateProductSchema = CreateProductSchema.partial();

export class UpdateProductDTO {
  @ApiPropertyOptional({ example: 'PRD-001' })
  code?: string;

  @ApiPropertyOptional({ example: '1234567890123' })
  barcode?: string | null;

  @ApiPropertyOptional({ example: 'Kopi Arabica 1Kg' })
  name?: string;

  @ApiPropertyOptional({ example: 'Biji kopi pilihan' })
  description?: string | null;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  category_id?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440001' })
  brand_id?: string | null;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440002' })
  uom_id?: string;

  @ApiPropertyOptional({ example: 'WAC', enum: ['WAC', 'FIFO'] })
  cost_method?: string;

  @ApiPropertyOptional({ example: 100000 })
  standard_cost?: number;

  @ApiPropertyOptional({ example: 150000 })
  selling_price?: number;

  @ApiPropertyOptional()
  min_selling_price?: number;

  @ApiPropertyOptional()
  reorder_point?: number;

  @ApiPropertyOptional()
  reorder_qty?: number;

  @ApiPropertyOptional()
  max_stock?: number | null;

  @ApiPropertyOptional()
  is_serialized?: boolean;

  @ApiPropertyOptional()
  is_batch_tracked?: boolean;

  @ApiPropertyOptional()
  is_active?: boolean;
}

// ── ProductFilter ─────────────────────────────────────────────────────────────

export const ProductFilterSchema = z.object({
  code: z.string().optional(),
  name: z.string().optional(),
  category_id: z.string().uuid().optional(),
  brand_id: z.string().uuid().optional(),
  is_active: z.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
});

export class ProductFilterDTO {
  @ApiPropertyOptional()
  code?: string;

  @ApiPropertyOptional()
  name?: string;

  @ApiPropertyOptional()
  category_id?: string;

  @ApiPropertyOptional()
  brand_id?: string;

  @ApiPropertyOptional()
  is_active?: boolean;

  @ApiPropertyOptional({ default: 1 })
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  per_page?: number;
}
