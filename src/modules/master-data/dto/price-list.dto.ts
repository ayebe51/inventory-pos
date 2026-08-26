import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsUUID,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsDate,
  IsInt,
  Min,
  Max,
  MaxLength,
  MinLength,
  ValidateNested,
  ArrayNotEmpty,
  ArrayMaxSize,
} from 'class-validator';
import { ToBooleanQuery } from '../../../common/utils/query-transform.util';

// ── CreatePriceListDTO ────────────────────────────────────────────────────────

export const CreatePriceListSchema = z.object({
  code: z.string().min(1, 'Kode price list wajib diisi').max(50, 'Kode price list maksimal 50 karakter'),
  name: z.string().min(1, 'Nama price list wajib diisi').max(200, 'Nama price list maksimal 200 karakter'),
  customer_id: z.string().uuid('customer_id harus berupa UUID').nullable().optional(),
  valid_from: z.coerce.date(),
  valid_to: z.coerce.date().nullable().optional(),
  is_active: z.boolean().default(true),
});

export class CreatePriceListDTO {
  @ApiProperty({ example: 'PL-001' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  code!: string;

  @ApiProperty({ example: 'Harga Eceran' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsOptional()
  @IsUUID()
  customer_id?: string | null;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  valid_from!: Date;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.000Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  valid_to?: Date | null;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

// ── UpdatePriceListDTO ────────────────────────────────────────────────────────

export const UpdatePriceListSchema = CreatePriceListSchema.partial();

export class UpdatePriceListDTO {
  @ApiPropertyOptional({ example: 'PL-001' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  code?: string;

  @ApiPropertyOptional({ example: 'Harga Eceran' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsOptional()
  @IsUUID()
  customer_id?: string | null;

  @ApiPropertyOptional({ example: '2026-01-01T00:00:00.000Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  valid_from?: Date;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.000Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  valid_to?: Date | null;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

// ── PriceItemDTO ──────────────────────────────────────────────────────────────

export const PriceItemSchema = z.object({
  product_id: z.string().uuid('product_id harus berupa UUID'),
  unit_price: z.number().min(0, 'Harga tidak boleh negatif'),
});

export class PriceItemDTO {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  product_id!: string;

  @ApiProperty({ example: 50000 })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  unit_price!: number;
}

// ── UpdatePricesDTO ───────────────────────────────────────────────────────────

export const UpdatePricesSchema = z.object({
  items: z.array(PriceItemSchema).min(1, 'Minimal satu item harga wajib diisi'),
});

export class UpdatePricesDTO {
  @ApiProperty({ type: [PriceItemDTO] })
  @ValidateNested({ each: true })
  @Type(() => PriceItemDTO)
  @ArrayNotEmpty()
  @ArrayMaxSize(1000)
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
  @IsOptional()
  @IsUUID()
  customer_id?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @ToBooleanQuery()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

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
