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
import { Type } from 'class-transformer';
import {
  IsUUID,
  IsNumber,
  IsOptional,
  IsString,
  IsInt,
  IsIn,
  Min,
  Max,
  MaxLength,
  ValidateNested,
  ArrayNotEmpty,
  ArrayMaxSize,
} from 'class-validator';

export class CreatePurchaseRequestLineDTO {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  product_id!: string;

  @ApiProperty({ example: 10 })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  qty_requested!: number;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  uom_id!: string;

  @ApiPropertyOptional({ example: 50000 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  estimated_price?: number;

  @ApiPropertyOptional({ example: 'Mohon segera diproses' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CreatePurchaseRequestDTO {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  branch_id!: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  warehouse_id!: string;

  @ApiPropertyOptional({ example: 'Pesanan untuk proyek A' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiProperty({ type: [CreatePurchaseRequestLineDTO] })
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseRequestLineDTO)
  @ArrayNotEmpty()
  @ArrayMaxSize(500)
  lines!: CreatePurchaseRequestLineDTO[];
}

export class UpdatePurchaseRequestDTO {
  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsOptional()
  @IsUUID()
  branch_id?: string;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsOptional()
  @IsUUID()
  warehouse_id?: string;

  @ApiPropertyOptional({ example: 'Pesanan untuk proyek A' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional({ type: [CreatePurchaseRequestLineDTO] })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseRequestLineDTO)
  @ArrayMaxSize(500)
  lines?: CreatePurchaseRequestLineDTO[];
}

export class PurchaseRequestFilter {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  pr_number?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branch_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  warehouse_id?: string;

  @ApiPropertyOptional({ enum: ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED'] })
  @IsOptional()
  @IsIn(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED'])
  status?: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  requested_by?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  date_from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  date_to?: string;

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

/**
 * DTO for searching Purchase Requests
 */
export class SearchPurchaseRequestDTO {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  pr_number?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branch_id?: UUID;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  warehouse_id?: UUID;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  requested_by?: UUID;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  date_from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  date_to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  per_page?: number;
}
