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
  if (!validateAccountCodeFormat(code)) return 0;
  return code.split('.').length;
}

// ── CreateCOADTO ──────────────────────────────────────────────────────────────

export const CreateCOASchema = z.object({
  account_code: z
    .string()
    .min(1, 'Kode akun wajib diisi')
    .max(20, 'Kode akun maksimal 20 karakter')
    .regex(ACCOUNT_CODE_REGEX, 'Format kode akun tidak valid. Contoh: 1, 1.001, 1.001.001'),
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

export type CreateCOADTO = z.infer<typeof CreateCOASchema>;

// ── UpdateCOADTO ──────────────────────────────────────────────────────────────

export const UpdateCOASchema = CreateCOASchema.partial().omit({ account_code: true }).extend({
  account_code: z
    .string()
    .min(1)
    .max(20)
    .regex(ACCOUNT_CODE_REGEX, 'Format kode akun tidak valid')
    .optional(),
});

export type UpdateCOADTO = z.infer<typeof UpdateCOASchema>;

// ── COAFilterDTO ──────────────────────────────────────────────────────────────

export const COAFilterSchema = z.object({
  account_type: AccountTypeEnum.optional(),
  is_header: z.boolean().optional(),
  is_active: z.boolean().optional(),
  parent_id: z.string().uuid().nullable().optional(),
  branch_id: z.string().uuid().nullable().optional(),
  search: z.string().optional(),
  page: z.number().int().min(1).default(1),
  per_page: z.number().int().min(1).max(100).default(20),
});

export type COAFilterDTO = z.input<typeof COAFilterSchema>;
