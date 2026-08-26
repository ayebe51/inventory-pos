import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ToBooleanQuery } from '../../../common/utils/query-transform.util';
import {
  IsUUID,
  IsBoolean,
  IsOptional,
  IsString,
  IsDate,
  IsInt,
  IsNumber,
  Min,
  Max,
  MaxLength,
  MinLength,
  ValidateNested,
  ArrayNotEmpty,
  ArrayMaxSize,
} from 'class-validator';

// ── CreateWarehouseDTO ────────────────────────────────────────────────────────

export const CreateWarehouseSchema = z.object({
  code: z.string().min(1, 'Kode gudang wajib diisi').max(20, 'Kode gudang maksimal 20 karakter'),
  name: z.string().min(1, 'Nama gudang wajib diisi').max(100, 'Nama gudang maksimal 100 karakter'),
  branch_id: z.string().uuid('branch_id harus berupa UUID'),
  address: z.string().nullable().optional(),
});

export class CreateWarehouseDTO {
  @ApiProperty({ example: 'WH-001' })
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  code!: string;

  @ApiProperty({ example: 'Gudang Utama' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  branch_id!: string;

  @ApiPropertyOptional({ example: 'Jl. Pegangsaan Timur No 56' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string | null;
}

// ── UpdateWarehouseDTO ────────────────────────────────────────────────────────

export const UpdateWarehouseSchema = CreateWarehouseSchema.partial();

export class UpdateWarehouseDTO {
  @ApiPropertyOptional({ example: 'WH-001' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  code?: string;

  @ApiPropertyOptional({ example: 'Gudang Utama' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsOptional()
  @IsUUID()
  branch_id?: string;

  @ApiPropertyOptional({ example: 'Jl. Pegangsaan Timur No 56' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string | null;
}

// ── LockWarehouseDTO ──────────────────────────────────────────────────────────

export const LockWarehouseSchema = z.object({
  reason: z.string().min(1, 'Alasan penguncian wajib diisi'),
});

export class LockWarehouseDTO {
  @ApiProperty({ example: 'Sedang stock opname' })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}

// ── WarehouseFilterDTO ────────────────────────────────────────────────────────

export const WarehouseFilterSchema = z.object({
  branch_id: z.string().uuid().optional(),
  is_active: z.boolean().optional(),
  is_locked: z.boolean().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
});

export class WarehouseFilterDTO {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branch_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ToBooleanQuery()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @ToBooleanQuery()
  @IsBoolean()
  is_locked?: boolean;

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
