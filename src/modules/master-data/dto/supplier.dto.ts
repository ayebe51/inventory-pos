import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ToBooleanQuery } from '../../../common/utils/query-transform.util';
import {
  IsEmail,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsInt,
  Min,
  Max,
  MaxLength,
  MinLength,
} from 'class-validator';

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

export class CreateSupplierDTO {
  @ApiProperty({ example: 'SUP-001' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  code!: string;

  @ApiProperty({ example: 'PT Distributor XYZ' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ example: 'info@xyz.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string | null;

  @ApiPropertyOptional({ example: '+628123456789' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string | null;

  @ApiPropertyOptional({ example: 'Jl. Merdeka No. 45' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string | null;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsInt()
  @Min(0)
  payment_terms_days?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

// ── UpdateSupplierDTO ─────────────────────────────────────────────────────────

export const UpdateSupplierSchema = CreateSupplierSchema.partial();

export class UpdateSupplierDTO {
  @ApiPropertyOptional({ example: 'SUP-001' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  code?: string;

  @ApiPropertyOptional({ example: 'PT Distributor XYZ' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ example: 'info@xyz.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string | null;

  @ApiPropertyOptional({ example: '+628123456789' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string | null;

  @ApiPropertyOptional({ example: 'Jl. Merdeka No. 45' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string | null;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @IsInt()
  @Min(0)
  payment_terms_days?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
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
