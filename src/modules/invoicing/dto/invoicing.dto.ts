import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsUUID,
  IsNumber,
  IsOptional,
  IsString,
  IsDate,
  IsIn,
  IsNotEmpty,
  Min,
  Max,
  MaxLength,
  ValidateNested,
  ArrayNotEmpty,
  ArrayMaxSize,
} from 'class-validator';
import { UUID } from '../../../common/types/uuid.type';

export class InvoiceLineDTO {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  product_id!: UUID;

  @ApiPropertyOptional({ example: 'Product Description' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ example: 10 })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  qty!: number;

  @ApiProperty({ example: 50000 })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  unit_price!: number;

  @ApiProperty({ example: 11 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  tax_pct!: number;
}

export class CreateSalesInvoiceDTO {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  customer_id!: UUID;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  branch_id!: UUID;

  @ApiProperty({ example: '2026-08-01T00:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  invoice_date!: Date;

  @ApiProperty({ example: '2026-08-31T00:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  due_date!: Date;

  @ApiPropertyOptional({ example: 'SALES_ORDER' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  reference_type?: string;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsOptional()
  @IsUUID()
  reference_id?: UUID;

  @ApiProperty({ type: [InvoiceLineDTO] })
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDTO)
  @ArrayNotEmpty()
  @ArrayMaxSize(500)
  lines!: InvoiceLineDTO[];
}

export class CreatePurchaseInvoiceDTO {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  supplier_id!: UUID;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  branch_id!: UUID;

  @ApiProperty({ example: '2026-08-01T00:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  invoice_date!: Date;

  @ApiProperty({ example: '2026-08-31T00:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  due_date!: Date;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsOptional()
  @IsUUID()
  po_id?: UUID;

  @ApiProperty({ type: [InvoiceLineDTO] })
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineDTO)
  @ArrayNotEmpty()
  @ArrayMaxSize(500)
  lines!: InvoiceLineDTO[];
}

export class AllocationDTO {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  invoice_id!: UUID;

  @ApiProperty({ example: 100000 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;
}

export class CreatePaymentDTO {
  @ApiProperty({ example: 'RECEIPT', enum: ['RECEIPT', 'VOUCHER'] })
  @IsIn(['RECEIPT', 'VOUCHER'])
  payment_type!: 'RECEIPT' | 'VOUCHER';

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsOptional()
  @IsUUID()
  customer_id?: UUID;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsOptional()
  @IsUUID()
  supplier_id?: UUID;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  branch_id!: UUID;

  @ApiProperty({ example: '2026-08-01T00:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  payment_date!: Date;

  @ApiProperty({ example: 100000 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsOptional()
  @IsUUID()
  bank_account_id?: UUID;

  @ApiPropertyOptional({ example: 'TRX-12345' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;

  @ApiPropertyOptional({ example: 'Pembayaran DP' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class BankStatementLineDTO {
  @ApiProperty({ example: '2026-08-01T00:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  transaction_date!: Date;

  @ApiProperty({ example: 'Transfer Masuk' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description!: string;

  @ApiProperty({ example: 100000 })
  @IsNumber({ maxDecimalPlaces: 2 })
  amount!: number;

  @ApiProperty({ example: 'CREDIT', enum: ['DEBIT', 'CREDIT'] })
  @IsIn(['DEBIT', 'CREDIT'])
  type!: 'DEBIT' | 'CREDIT';

  @ApiPropertyOptional({ example: 'REF-123' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference!: string | null;
}

export class BankStatementDTO {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  bank_account_id!: UUID;

  @ApiProperty({ example: '2026-08-01T00:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  statement_date!: Date;

  @ApiProperty({ example: 1000000 })
  @IsNumber({ maxDecimalPlaces: 2 })
  opening_balance!: number;

  @ApiProperty({ example: 1100000 })
  @IsNumber({ maxDecimalPlaces: 2 })
  closing_balance!: number;

  @ApiProperty({ type: [BankStatementLineDTO] })
  @ValidateNested({ each: true })
  @Type(() => BankStatementLineDTO)
  @ArrayMaxSize(5000)
  lines!: BankStatementLineDTO[];
}
