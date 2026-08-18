import { z } from 'zod';

// ── CreateCustomerDTO ─────────────────────────────────────────────────────────

export const CreateCustomerSchema = z.object({
  code: z.string().min(1, 'Kode customer wajib diisi').max(50, 'Kode customer maksimal 50 karakter'),
  name: z.string().min(1, 'Nama customer wajib diisi').max(200, 'Nama customer maksimal 200 karakter'),
  email: z.string().email('Format email tidak valid').max(200).nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  address: z.string().nullable().optional(),
  credit_limit: z.number().min(0, 'Credit limit harus >= 0').default(0),
  is_active: z.boolean().default(true),
});

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCustomerDTO {
  @ApiProperty({ example: 'CUST-001' })
  code!: string;

  @ApiProperty({ example: 'PT Maju Bersama' })
  name!: string;

  @ApiPropertyOptional({ example: 'contact@majubersama.com' })
  email?: string | null;

  @ApiPropertyOptional({ example: '+628123456789' })
  phone?: string | null;

  @ApiPropertyOptional({ example: 'Jl. Sudirman No. 1' })
  address?: string | null;

  @ApiPropertyOptional({ example: 10000000 })
  credit_limit?: number;

  @ApiPropertyOptional({ example: true })
  is_active?: boolean;
}

// ── UpdateCustomerDTO ─────────────────────────────────────────────────────────

export const UpdateCustomerSchema = CreateCustomerSchema.partial();

export class UpdateCustomerDTO {
  @ApiPropertyOptional({ example: 'CUST-001' })
  code?: string;

  @ApiPropertyOptional({ example: 'PT Maju Bersama' })
  name?: string;

  @ApiPropertyOptional({ example: 'contact@majubersama.com' })
  email?: string | null;

  @ApiPropertyOptional({ example: '+628123456789' })
  phone?: string | null;

  @ApiPropertyOptional({ example: 'Jl. Sudirman No. 1' })
  address?: string | null;

  @ApiPropertyOptional({ example: 10000000 })
  credit_limit?: number;

  @ApiPropertyOptional({ example: true })
  is_active?: boolean;
}

// ── CustomerFilter ────────────────────────────────────────────────────────────

export const CustomerFilterSchema = z.object({
  code: z.string().optional(),
  name: z.string().optional(),
  is_active: z.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
});

export class CustomerFilter {
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
