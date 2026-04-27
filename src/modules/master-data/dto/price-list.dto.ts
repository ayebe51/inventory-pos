import { z } from 'zod';

// ── CreatePriceListDTO ────────────────────────────────────────────────────────

export const CreatePriceListSchema = z.object({
  code: z.string().min(1, 'Kode price list wajib diisi').max(50, 'Kode price list maksimal 50 karakter'),
  name: z.string().min(1, 'Nama price list wajib diisi').max(200, 'Nama price list maksimal 200 karakter'),
  customer_id: z.string().uuid('customer_id harus berupa UUID').nullable().optional(),
  valid_from: z.coerce.date(),
  valid_to: z.coerce.date().nullable().optional(),
  is_active: z.boolean().default(true),
});

export type CreatePriceListDTO = z.infer<typeof CreatePriceListSchema>;

// ── UpdatePriceListDTO ────────────────────────────────────────────────────────

export const UpdatePriceListSchema = CreatePriceListSchema.partial();

export type UpdatePriceListDTO = z.infer<typeof UpdatePriceListSchema>;

// ── PriceItemDTO ──────────────────────────────────────────────────────────────

export const PriceItemSchema = z.object({
  product_id: z.string().uuid('product_id harus berupa UUID'),
  unit_price: z.number().min(0, 'Harga tidak boleh negatif'),
});

export type PriceItemDTO = z.infer<typeof PriceItemSchema>;

// ── UpdatePricesDTO ───────────────────────────────────────────────────────────

export const UpdatePricesSchema = z.object({
  items: z.array(PriceItemSchema).min(1, 'Minimal satu item harga wajib diisi'),
});

export type UpdatePricesDTO = z.infer<typeof UpdatePricesSchema>;

// ── PriceListFilterDTO ────────────────────────────────────────────────────────

export const PriceListFilterSchema = z.object({
  customer_id: z.string().uuid().nullable().optional(),
  is_active: z.boolean().optional(),
  search: z.string().optional(),
  page: z.number().int().min(1).default(1),
  per_page: z.number().int().min(1).max(100).default(20),
});

export type PriceListFilterDTO = z.input<typeof PriceListFilterSchema>;
