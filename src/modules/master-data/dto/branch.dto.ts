import { z } from 'zod';

// ── CreateHeadOfficeDTO ───────────────────────────────────────────────────────

export const CreateHeadOfficeSchema = z.object({
  code: z.string().min(1, 'Kode wajib diisi').max(20, 'Kode maksimal 20 karakter'),
  name: z.string().min(1, 'Nama wajib diisi').max(200, 'Nama maksimal 200 karakter'),
  address: z.string().nullable().optional(),
});

export type CreateHeadOfficeDTO = z.infer<typeof CreateHeadOfficeSchema>;

// ── CreateBranchDTO ───────────────────────────────────────────────────────────

export const CreateBranchSchema = z.object({
  code: z.string().min(1, 'Kode wajib diisi').max(20, 'Kode maksimal 20 karakter'),
  name: z.string().min(1, 'Nama wajib diisi').max(200, 'Nama maksimal 200 karakter'),
  parent_id: z.string().uuid('parent_id harus berupa UUID'),
  address: z.string().nullable().optional(),
});

export type CreateBranchDTO = z.infer<typeof CreateBranchSchema>;
