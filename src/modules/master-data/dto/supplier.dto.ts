import { z } from 'zod';

// ── CreateSupplierDTO ─────────────────────────────────────────────────────────

export const CreateSupplierSchema = z.object({
  code: z.string().min(1, 'Kode supplier wajib diisi').max(50, 'Kode supplier maksimal 50 karakter'),
  name: z.string().min(1, 'Nama supplier wajib diisi').max(200, 'Nama supplier maksimal 200 karakter'),
  email: z.string().email('Format email tidak valid').max(200).nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  address: z.string().nullable().optional(),
  payment_terms_days: z.number().int().min(0, 'Payment terms harus >= 0').default(30),
  is_active: z.boolean().default(true),
});

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSupplierDTO {
  @ApiProperty({ example: 'SUP-001' })
  code!: string;

  @ApiProperty({ example: 'PT Distributor XYZ' })
  name!: string;

  @ApiPropertyOptional({ example: 'info@xyz.com' })
  email?: string | null;

  @ApiPropertyOptional({ example: '+628123456789' })
  phone?: string | null;

  @ApiPropertyOptional({ example: 'Jl. Merdeka No. 45' })
  address?: string | null;

  @ApiPropertyOptional({ example: 30 })
  payment_terms_days?: number;

  @ApiPropertyOptional({ example: true })
  is_active?: boolean;
}

// ── UpdateSupplierDTO ─────────────────────────────────────────────────────────

export const UpdateSupplierSchema = CreateSupplierSchema.partial();

export class UpdateSupplierDTO {
  @ApiPropertyOptional({ example: 'SUP-001' })
  code?: string;

  @ApiPropertyOptional({ example: 'PT Distributor XYZ' })
  name?: string;

  @ApiPropertyOptional({ example: 'info@xyz.com' })
  email?: string | null;

  @ApiPropertyOptional({ example: '+628123456789' })
  phone?: string | null;

  @ApiPropertyOptional({ example: 'Jl. Merdeka No. 45' })
  address?: string | null;

  @ApiPropertyOptional({ example: 30 })
  payment_terms_days?: number;

  @ApiPropertyOptional({ example: true })
  is_active?: boolean;
}

// ── SupplierFilter ────────────────────────────────────────────────────────────

export const SupplierFilterSchema = z.object({
  code: z.string().optional(),
  name: z.string().optional(),
  is_active: z.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
});

export class SupplierFilter {
  @ApiPropertyOptional()
  code?: string;

  @ApiPropertyOptional()
  name?: string;

  @ApiPropertyOptional()
  is_active?: boolean;

  @ApiPropertyOptional({ default: 1 })
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  per_page?: number;
}
