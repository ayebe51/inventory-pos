import { z } from 'zod';

// ── Account type enum ─────────────────────────────────────────────────────────

export const AccountTypeEnum = z.enum([
  'ASSET',
  'LIABILITY',
  'EQUITY',
  'REVENUE',
  'EXPENSE',
  'COGS',
  'OTHER_INCOME',
  'OTHER_EXPENSE',
]);

export type AccountType = z.infer<typeof AccountTypeEnum>;

// ── Account code format validation ────────────────────────────────────────────
// Level 1: "1"
// Level 2: "1.001"
// Level 3: "1.001.001"
// Level 4: "1.001.001.001"
// Level 5: "1.001.001.001.001"

const ACCOUNT_CODE_REGEX = /^\d(\.\d{3}){0,4}$/;

export function validateAccountCodeFormat(code: string): boolean {
  return ACCOUNT_CODE_REGEX.test(code);
}

export function getAccountCodeLevel(code: string): number {
  if (!code || !validateAccountCodeFormat(code)) return 0;
  return code.includes('.') ? code.split('.').length : 1;
}

// ── CreateCOADTO ──────────────────────────────────────────────────────────────

export const CreateCOASchema = z.object({
  account_code: z
    .string()
    .min(1, 'Kode akun wajib diisi')
    .max(20, 'Kode akun maksimal 20 karakter')
    .regex(ACCOUNT_CODE_REGEX, 'Format kode akun tidak valid. Contoh: 6000, 6001, 6.001'),
  account_name: z
    .string()
    .min(1, 'Nama akun wajib diisi')
    .max(200, 'Nama akun maksimal 200 karakter'),
  account_type: AccountTypeEnum,
  account_category: z.string().max(100).nullable().optional(),
  parent_id: z.string().uuid('parent_id harus berupa UUID').nullable().optional(),
  is_header: z.boolean().default(false),
  normal_balance: z.enum(['DEBIT', 'CREDIT']),
  is_active: z.boolean().default(true),
  branch_id: z.string().uuid('branch_id harus berupa UUID').nullable().optional(),
});

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCOADTO {
  @ApiProperty({ example: '1.001' })
  account_code!: string;

  @ApiProperty({ example: 'Kas di Bank' })
  account_name!: string;

  @ApiProperty({ enum: ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE', 'COGS', 'OTHER_INCOME', 'OTHER_EXPENSE'], example: 'ASSET' })
  account_type!: AccountType;

  @ApiPropertyOptional({ example: 'Current Asset' })
  account_category?: string | null;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000' })
  parent_id?: string | null;

  @ApiPropertyOptional({ example: false })
  is_header?: boolean;

  @ApiProperty({ enum: ['DEBIT', 'CREDIT'], example: 'DEBIT' })
  normal_balance!: 'DEBIT' | 'CREDIT';

  @ApiPropertyOptional({ example: true })
  is_active?: boolean;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000' })
  branch_id?: string | null;
}

// ── UpdateCOADTO ──────────────────────────────────────────────────────────────

export const UpdateCOASchema = CreateCOASchema.partial().omit({ account_code: true }).extend({
  account_code: z
    .string()
    .min(1)
    .max(20)
    .regex(ACCOUNT_CODE_REGEX, 'Format kode akun tidak valid')
    .optional(),
});

export class UpdateCOADTO {
  @ApiPropertyOptional({ example: '1.001' })
  account_code?: string;

  @ApiPropertyOptional({ example: 'Kas di Bank' })
  account_name?: string;

  @ApiPropertyOptional({ enum: ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE', 'COGS', 'OTHER_INCOME', 'OTHER_EXPENSE'] })
  account_type?: AccountType;

  @ApiPropertyOptional({ example: 'Current Asset' })
  account_category?: string | null;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000' })
  parent_id?: string | null;

  @ApiPropertyOptional({ example: false })
  is_header?: boolean;

  @ApiPropertyOptional({ enum: ['DEBIT', 'CREDIT'] })
  normal_balance?: 'DEBIT' | 'CREDIT';

  @ApiPropertyOptional({ example: true })
  is_active?: boolean;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000' })
  branch_id?: string | null;
}

// ── COAFilterDTO ──────────────────────────────────────────────────────────────

export const COAFilterSchema = z.object({
  account_type: AccountTypeEnum.optional(),
  is_header: z.boolean().optional(),
  is_active: z.boolean().optional(),
  parent_id: z.string().uuid().nullable().optional(),
  branch_id: z.string().uuid().nullable().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  per_page: z.coerce.number().int().min(1).max(100).default(20),
});

export class COAFilterDTO {
  @ApiPropertyOptional({ enum: ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE', 'COGS', 'OTHER_INCOME', 'OTHER_EXPENSE'] })
  account_type?: AccountType;

  @ApiPropertyOptional()
  is_header?: boolean;

  @ApiPropertyOptional()
  is_active?: boolean;

  @ApiPropertyOptional()
  parent_id?: string | null;

  @ApiPropertyOptional()
  branch_id?: string | null;

  @ApiPropertyOptional()
  search?: string;

  @ApiPropertyOptional({ default: 1 })
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  per_page?: number;
}
