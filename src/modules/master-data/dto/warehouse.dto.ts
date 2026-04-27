import { z } from 'zod';

// ── CreateWarehouseDTO ────────────────────────────────────────────────────────

export const CreateWarehouseSchema = z.object({
  code: z.string().min(1, 'Kode gudang wajib diisi').max(20, 'Kode gudang maksimal 20 karakter'),
  name: z.string().min(1, 'Nama gudang wajib diisi').max(100, 'Nama gudang maksimal 100 karakter'),
  branch_id: z.string().uuid('branch_id harus berupa UUID'),
  address: z.string().nullable().optional(),
});

export type CreateWarehouseDTO = z.infer<typeof CreateWarehouseSchema>;

// ── UpdateWarehouseDTO ────────────────────────────────────────────────────────

export const UpdateWarehouseSchema = CreateWarehouseSchema.partial();

export type UpdateWarehouseDTO = z.infer<typeof UpdateWarehouseSchema>;

// ── LockWarehouseDTO ──────────────────────────────────────────────────────────

export const LockWarehouseSchema = z.object({
  reason: z.string().min(1, 'Alasan penguncian wajib diisi'),
});

export type LockWarehouseDTO = z.infer<typeof LockWarehouseSchema>;

// ── WarehouseFilterDTO ────────────────────────────────────────────────────────

export const WarehouseFilterSchema = z.object({
  branch_id: z.string().uuid().optional(),
  is_active: z.boolean().optional(),
  is_locked: z.boolean().optional(),
  search: z.string().optional(),
  page: z.number().int().min(1).default(1),
  per_page: z.number().int().min(1).max(100).default(20),
});

export type WarehouseFilterDTO = z.input<typeof WarehouseFilterSchema>;
