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

export type CreateCustomerDTO = z.infer<typeof CreateCustomerSchema>;

// ── UpdateCustomerDTO ─────────────────────────────────────────────────────────

export const UpdateCustomerSchema = CreateCustomerSchema.partial();

export type UpdateCustomerDTO = z.infer<typeof UpdateCustomerSchema>;

// ── CustomerFilter ────────────────────────────────────────────────────────────

export const CustomerFilterSchema = z.object({
  code: z.string().optional(),
  name: z.string().optional(),
  is_active: z.boolean().optional(),
  page: z.number().int().min(1).default(1),
  per_page: z.number().int().min(1).max(100).default(20),
});

export type CustomerFilter = z.input<typeof CustomerFilterSchema>;
