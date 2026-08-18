import { UUID } from '../../../common/types/uuid.type';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for Goods Receipt line item
 */
export class CreateGoodsReceiptLineDTO {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  po_line_id!: UUID;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  product_id!: UUID;

  @ApiProperty({ example: 100 })
  qty_received!: number;

  @ApiProperty({ example: 150000 })
  unit_cost!: number;

  @ApiPropertyOptional({ example: 'Kondisi baik' })
  notes?: string;
}

/**
 * DTO for creating a new Goods Receipt
 */
export class CreateGoodsReceiptDTO {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  po_id!: UUID;

  @ApiProperty({ example: '2026-08-01T00:00:00.000Z' })
  receipt_date!: Date | string;

  @ApiPropertyOptional({ example: 'Pengiriman batch 1' })
  notes?: string;

  @ApiProperty({ type: [CreateGoodsReceiptLineDTO] })
  lines!: CreateGoodsReceiptLineDTO[];
}

/**
 * DTO for confirming a Goods Receipt
 */
export class ConfirmGoodsReceiptDTO {
  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000' })
  confirmed_by?: UUID; // Optional, will be set from JWT
}

/**
 * DTO for searching Goods Receipts
 */
export class SearchGoodsReceiptDTO {
  @ApiPropertyOptional()
  gr_number?: string;

  @ApiPropertyOptional()
  po_id?: UUID;

  @ApiPropertyOptional()
  supplier_id?: UUID;

  @ApiPropertyOptional()
  warehouse_id?: UUID;

  @ApiPropertyOptional({ enum: ['DRAFT', 'CONFIRMED'] })
  status?: 'DRAFT' | 'CONFIRMED';

  @ApiPropertyOptional()
  date_from?: string;

  @ApiPropertyOptional()
  date_to?: string;

  @ApiPropertyOptional()
  page?: number;

  @ApiPropertyOptional()
  per_page?: number;
}
