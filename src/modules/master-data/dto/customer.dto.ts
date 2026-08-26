import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ToBooleanQuery } from '../../../common/utils/query-transform.util';
import { z } from 'zod';
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

export class CreateCustomerDTO {
  @ApiProperty({ example: 'CUST-001' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  code!: string;

  @ApiProperty({ example: 'PT Maju Bersama' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional({ example: 'contact@majubersama.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string | null;

  @ApiPropertyOptional({ example: '+628123456789' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string | null;

  @ApiPropertyOptional({ example: 'Jl. Sudirman No. 1' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string | null;

  @ApiPropertyOptional({ example: 10000000 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  credit_limit?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

// ── UpdateCustomerDTO ─────────────────────────────────────────────────────────

export const UpdateCustomerSchema = CreateCustomerSchema.partial();

export class UpdateCustomerDTO {
  @ApiPropertyOptional({ example: 'CUST-001' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  code?: string;

  @ApiPropertyOptional({ example: 'PT Maju Bersama' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ example: 'contact@majubersama.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string | null;

  @ApiPropertyOptional({ example: '+628123456789' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string | null;

  @ApiPropertyOptional({ example: 'Jl. Sudirman No. 1' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string | null;

  @ApiPropertyOptional({ example: 10000000 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  credit_limit?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
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
