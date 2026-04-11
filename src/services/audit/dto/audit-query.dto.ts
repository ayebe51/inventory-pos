import { z } from 'zod';

export const AuditQuerySchema = z.object({
  user_id: z.string().uuid().optional(),
  action: z.string().max(50).optional(),
  entity_type: z.string().max(100).optional(),
  entity_id: z.string().uuid().optional(),
  from_date: z
    .string()
    .datetime({ offset: true })
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
  to_date: z
    .string()
    .datetime({ offset: true })
    .optional()
    .transform((v) => (v ? new Date(v) : undefined)),
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1))
    .pipe(z.number().int().min(1).default(1)),
  per_page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 20))
    .pipe(z.number().int().min(1).max(100).default(20)),
});

export type AuditQueryDTO = z.infer<typeof AuditQuerySchema>;
