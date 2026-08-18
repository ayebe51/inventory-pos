import { z } from 'zod';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ── CreateHeadOfficeDTO ───────────────────────────────────────────────────────

export const CreateHeadOfficeSchema = z.object({
  code: z.string().min(1, 'Kode wajib diisi').max(20, 'Kode maksimal 20 karakter'),
  name: z.string().min(1, 'Nama wajib diisi').max(200, 'Nama maksimal 200 karakter'),
  address: z.string().nullable().optional(),
});

export class CreateHeadOfficeDTO {
  @ApiProperty({ example: 'HQ-001' })
  code!: string;

  @ApiProperty({ example: 'Kantor Pusat Jakarta' })
  name!: string;

  @ApiPropertyOptional({ example: 'Jl. Jend. Sudirman No. 1' })
  address?: string | null;
}

// ── CreateBranchDTO ───────────────────────────────────────────────────────────

export const CreateBranchSchema = z.object({
  code: z.string().min(1, 'Kode wajib diisi').max(20, 'Kode maksimal 20 karakter'),
  name: z.string().min(1, 'Nama wajib diisi').max(200, 'Nama maksimal 200 karakter'),
  parent_id: z.string().uuid('parent_id harus berupa UUID'),
  address: z.string().nullable().optional(),
});

export class CreateBranchDTO {
  @ApiProperty({ example: 'BR-001' })
  code!: string;

  @ApiProperty({ example: 'Cabang Bandung' })
  name!: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  parent_id!: string;

  @ApiPropertyOptional({ example: 'Jl. Asia Afrika No. 10' })
  address?: string | null;
}
