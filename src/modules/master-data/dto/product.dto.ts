import { z } from 'zod';

// ── CreateProductDTO ──────────────────────────────────────────────────────────

export const CreateProductSchema = z.object({
  code: z.string().min(1, 'Kode produk wajib diisi').max(50, 'Kode produk maksimal 50 karakter'),
  barcode: z.string().max(100).nullable().optional(),
  name: z.string().min(1, 'Nama produk wajib diisi').max(200, 'Nama produk maksimal 200 karakter'),
  description: z.string().nullable().optional(),
  category_id: z.string().uuid('category_id harus berupa UUID'),
  brand_id: z.string().uuid('brand_id harus berupa UUID').nullable().optional(),
  uom_id: z.string().uuid('uom_id harus berupa UUID'),
  uom_purchase_id: z.string().uuid('uom_purchase_id harus berupa UUID').nullable().optional(),
  uom_sales_id: z.string().uuid('uom_sales_id harus berupa UUID').nullable().optional(),
  cost_method: z.enum(['WAC', 'FIFO']).default('WAC'),
  standard_cost: z.number().min(0, 'standard_cost harus >= 0').default(0),
  selling_price: z.number().min(0, 'selling_price harus >= 0').default(0),
  min_selling_price: z.number().min(0, 'min_selling_price harus >= 0').default(0),
  reorder_point: z.number().min(0).default(0),
  reorder_qty: z.number().min(0).default(0),
  max_stock: z.number().min(0).nullable().optional(),
  is_serialized: z.boolean().default(false),
  is_batch_tracked: z.boolean().default(false),
  is_active: z.boolean().default(true),
  tax_category: z.string().max(50).nullable().optional(),
  weight: z.number().min(0).nullable().optional(),
  volume: z.number().min(0).nullable().optional(),
  image_url: z.string().max(500).url('image_url harus berupa URL valid').nullable().optional(),
  notes: z.string().nullable().optional(),
});

export type CreateProductDTO = z.infer<typeof CreateProductSchema>;

// ── UpdateProductDTO ──────────────────────────────────────────────────────────

export const UpdateProductSchema = CreateProductSchema.partial();

export type UpdateProductDTO = z.infer<typeof UpdateProductSchema>;

// ── ProductFilter ─────────────────────────────────────────────────────────────

export const ProductFilterSchema = z.object({
  code: z.string().optional(),
  name: z.string().optional(),
  category_id: z.string().uuid().optional(),
  brand_id: z.string().uuid().optional(),
  is_active: z.boolean().optional(),
  page: z.number().int().min(1).default(1),
  per_page: z.number().int().min(1).max(100).default(20),
});

export type ProductFilter = z.input<typeof ProductFilterSchema>;
