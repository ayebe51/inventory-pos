import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UUID } from '../../../common/types/uuid.type';

export class InvoiceLineDTO {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  product_id!: UUID;

  @ApiPropertyOptional({ example: 'Product Description' })
  description?: string;

  @ApiProperty({ example: 10 })
  qty!: number;

  @ApiProperty({ example: 50000 })
  unit_price!: number;

  @ApiProperty({ example: 11 })
  tax_pct!: number;
}

export class CreateSalesInvoiceDTO {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  customer_id!: UUID;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  branch_id!: UUID;

  @ApiProperty({ example: '2026-08-01T00:00:00.000Z' })
  invoice_date!: Date;

  @ApiProperty({ example: '2026-08-31T00:00:00.000Z' })
  due_date!: Date;

  @ApiPropertyOptional({ example: 'SALES_ORDER' })
  reference_type?: string;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000' })
  reference_id?: UUID;

  @ApiProperty({ type: [InvoiceLineDTO] })
  lines!: InvoiceLineDTO[];
}

export class CreatePurchaseInvoiceDTO {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  supplier_id!: UUID;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  branch_id!: UUID;

  @ApiProperty({ example: '2026-08-01T00:00:00.000Z' })
  invoice_date!: Date;

  @ApiProperty({ example: '2026-08-31T00:00:00.000Z' })
  due_date!: Date;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000' })
  po_id?: UUID;

  @ApiProperty({ type: [InvoiceLineDTO] })
  lines!: InvoiceLineDTO[];
}

export class AllocationDTO {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  invoice_id!: UUID;

  @ApiProperty({ example: 100000 })
  amount!: number;
}

export class CreatePaymentDTO {
  @ApiProperty({ example: 'RECEIPT', enum: ['RECEIPT', 'VOUCHER'] })
  payment_type!: 'RECEIPT' | 'VOUCHER';

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000' })
  customer_id?: UUID;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000' })
  supplier_id?: UUID;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  branch_id!: UUID;

  @ApiProperty({ example: '2026-08-01T00:00:00.000Z' })
  payment_date!: Date;

  @ApiProperty({ example: 100000 })
  amount!: number;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000' })
  bank_account_id?: UUID;

  @ApiPropertyOptional({ example: 'TRX-12345' })
  reference?: string;

  @ApiPropertyOptional({ example: 'Pembayaran DP' })
  notes?: string;
}

export class BankStatementLineDTO {
  @ApiProperty({ example: '2026-08-01T00:00:00.000Z' })
  transaction_date!: Date;

  @ApiProperty({ example: 'Transfer Masuk' })
  description!: string;

  @ApiProperty({ example: 100000 })
  amount!: number;

  @ApiProperty({ example: 'CREDIT', enum: ['DEBIT', 'CREDIT'] })
  type!: 'DEBIT' | 'CREDIT';

  @ApiPropertyOptional({ example: 'REF-123' })
  reference!: string | null;
}

export class BankStatementDTO {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  bank_account_id!: UUID;

  @ApiProperty({ example: '2026-08-01T00:00:00.000Z' })
  statement_date!: Date;

  @ApiProperty({ example: 1000000 })
  opening_balance!: number;

  @ApiProperty({ example: 1100000 })
  closing_balance!: number;

  @ApiProperty({ type: [BankStatementLineDTO] })
  lines!: BankStatementLineDTO[];
}
