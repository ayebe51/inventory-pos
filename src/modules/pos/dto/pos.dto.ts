import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UUID } from '../../../common/types/uuid.type';

export class OpenShiftDTO {
  @ApiProperty({ example: 1000000 })
  opening_balance!: number;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000' })
  branch_id?: string;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000' })
  warehouse_id?: string;
}

export class CloseShiftDTO {
  @ApiProperty({ example: 5000000 })
  closing_balance!: number;
}

export class POSLineItemDTO {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  product_id!: UUID;

  @ApiProperty({ example: 2 })
  qty!: number;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  uom_id!: UUID;

  @ApiProperty({ example: 150000 })
  unit_price!: number;

  @ApiPropertyOptional({ example: 10 })
  discount_pct?: number;

  @ApiProperty({ example: 1 })
  version!: number;
}

export class PaymentMethodDTO {
  @ApiProperty({ example: 'CASH', enum: ['CASH', 'CARD', 'TRANSFER', 'EDC'] })
  method!: 'CASH' | 'CARD' | 'TRANSFER' | 'EDC';

  @ApiProperty({ example: 300000 })
  amount!: number;

  @ApiPropertyOptional({ example: 'REF-12345' })
  reference?: string;

  @ApiProperty({ example: 1 })
  version!: number;
}

export class ProcessTransactionDTO {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  shift_id!: UUID;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000' })
  customer_id?: UUID;

  @ApiProperty({ type: [POSLineItemDTO] })
  items!: POSLineItemDTO[];

  @ApiProperty({ type: [PaymentMethodDTO] })
  payments!: PaymentMethodDTO[];
}

export class VoidTransactionDTO {
  @ApiProperty({ example: 'Customer canceled' })
  reason!: string;
}

export class CreateSOLineDTO {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  product_id!: UUID;

  @ApiProperty({ example: 5 })
  qty!: number;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  uom_id!: UUID;

  @ApiProperty({ example: 200000 })
  unit_price!: number;
}

export class CreateSODTO {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  customer_id!: UUID;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  branch_id!: UUID;

  @ApiProperty({ example: '2026-08-01T00:00:00.000Z' })
  order_date!: Date;

  @ApiProperty({ type: [CreateSOLineDTO] })
  lines!: CreateSOLineDTO[];
}

export class FulfillmentLineDTO {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  so_line_id!: UUID;

  @ApiProperty({ example: 5 })
  qty_fulfilled!: number;
}

export class FulfillmentDTO {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  warehouse_id!: UUID;

  @ApiProperty({ example: '2026-08-05T00:00:00.000Z' })
  delivery_date!: Date;

  @ApiProperty({ type: [FulfillmentLineDTO] })
  lines!: FulfillmentLineDTO[];
}

export class SalesReturnLineDTO {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  product_id!: UUID;

  @ApiProperty({ example: 1 })
  qty!: number;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  uom_id!: UUID;

  @ApiProperty({ example: 200000 })
  unit_price!: number;
}

export class SalesReturnDTO {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  customer_id!: UUID;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  warehouse_id!: UUID;

  @ApiProperty({ example: 'POS' })
  reference_type!: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  reference_id!: UUID;

  @ApiProperty({ example: '2026-08-10T00:00:00.000Z' })
  return_date!: Date;

  @ApiProperty({ example: 'Barang rusak' })
  reason!: string;

  @ApiProperty({ type: [SalesReturnLineDTO] })
  lines!: SalesReturnLineDTO[];
}
