import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsUUID,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsIn,
  IsInt,
  IsUrl,
  Min,
  Max,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ToBooleanQuery } from '../../../common/utils/query-transform.util';

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
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  code!: string;

  @ApiPropertyOptional({ example: '1234567890123' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  barcode?: string | null;

  @ApiProperty({ example: 'Kopi Arabica 1Kg' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ example: 'Biji kopi pilihan' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  category_id!: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440001' })
  @IsOptional()
  @IsUUID()
  brand_id?: string | null;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440002' })
  @IsUUID()
  uom_id!: string;

  @ApiProperty({ example: 'WAC', enum: ['WAC', 'FIFO'] })
  @IsOptional()
  @IsIn(['WAC', 'FIFO'])
  cost_method?: string = 'WAC';

  @ApiProperty({ example: 100000 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  standard_cost?: number = 0;

  @ApiProperty({ example: 150000 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  selling_price?: number = 0;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  min_selling_price?: number = 0;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  reorder_point?: number = 0;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  reorder_qty?: number = 0;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  max_stock?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_serialized?: boolean = false;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_batch_tracked?: boolean = false;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_active?: boolean = true;
}

// ── UpdateProductDTO ──────────────────────────────────────────────────────────

export const UpdateProductSchema = CreateProductSchema.partial();

export class UpdateProductDTO {
  @ApiPropertyOptional({ example: 'PRD-001' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  code?: string;

  @ApiPropertyOptional({ example: '1234567890123' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  barcode?: string | null;

  @ApiPropertyOptional({ example: 'Kopi Arabica 1Kg' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ example: 'Biji kopi pilihan' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsOptional()
  @IsUUID()
  category_id?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440001' })
  @IsOptional()
  @IsUUID()
  brand_id?: string | null;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440002' })
  @IsOptional()
  @IsUUID()
  uom_id?: string;

  @ApiPropertyOptional({ example: 'WAC', enum: ['WAC', 'FIFO'] })
  @IsOptional()
  @IsIn(['WAC', 'FIFO'])
  cost_method?: string;

  @ApiPropertyOptional({ example: 100000 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  standard_cost?: number;

  @ApiPropertyOptional({ example: 150000 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  selling_price?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  min_selling_price?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  reorder_point?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  reorder_qty?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  max_stock?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_serialized?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  is_batch_tracked?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
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
  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  category_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  brand_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ToBooleanQuery()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  per_page?: number;
}
