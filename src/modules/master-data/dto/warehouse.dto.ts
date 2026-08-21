import { z } from 'zod';

// ── CreateWarehouseDTO ────────────────────────────────────────────────────────

export const CreateWarehouseSchema = z.object({
  code: z.string().min(1, 'Kode gudang wajib diisi').max(20, 'Kode gudang maksimal 20 karakter'),
  name: z.string().min(1, 'Nama gudang wajib diisi').max(100, 'Nama gudang maksimal 100 karakter'),
  branch_id: z.string().uuid('branch_id harus berupa UUID'),
  address: z.string().nullable().optional(),
});

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWarehouseDTO {
  @ApiProperty({ example: 'WH-001' })
  code!: string;

  @ApiProperty({ example: 'Gudang Utama' })
  name!: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  branch_id!: string;

  @ApiPropertyOptional({ example: 'Jl. Pegangsaan Timur No 56' })
  address?: string | null;
}

// ── UpdateWarehouseDTO ────────────────────────────────────────────────────────

export const UpdateWarehouseSchema = CreateWarehouseSchema.partial();

export class UpdateWarehouseDTO {
  @ApiPropertyOptional({ example: 'WH-001' })
  code?: string;

  @ApiPropertyOptional({ example: 'Gudang Utama' })
  name?: string;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000' })
  branch_id?: string;

  @ApiPropertyOptional({ example: 'Jl. Pegangsaan Timur No 56' })
  address?: string | null;
}

// ── LockWarehouseDTO ──────────────────────────────────────────────────────────

export const LockWarehouseSchema = z.object({
  reason: z.string().min(1, 'Alasan penguncian wajib diisi'),
});

export class LockWarehouseDTO {
  @ApiProperty({ example: 'Sedang stock opname' })
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
  branch_id?: string;

  @ApiPropertyOptional()
  is_active?: boolean;

  @ApiPropertyOptional()
  is_locked?: boolean;

  @ApiPropertyOptional()
  search?: string;

  @ApiPropertyOptional({ default: 1 })
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  per_page?: number;
}
