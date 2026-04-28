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

export type CreateSupplierDTO = z.infer<typeof CreateSupplierSchema>;

// ── UpdateSupplierDTO ─────────────────────────────────────────────────────────

export const UpdateSupplierSchema = CreateSupplierSchema.partial();

export type UpdateSupplierDTO = z.infer<typeof UpdateSupplierSchema>;

// ── SupplierFilter ────────────────────────────────────────────────────────────

export const SupplierFilterSchema = z.object({
  code: z.string().optional(),
  name: z.string().optional(),
  is_active: z.boolean().optional(),
  page: z.number().int().min(1).default(1),
  per_page: z.number().int().min(1).max(100).default(20),
});

export type SupplierFilter = z.input<typeof SupplierFilterSchema>;
