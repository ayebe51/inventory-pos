import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsUUID,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  Max,
  ValidateNested,
  ArrayNotEmpty,
  ArrayMaxSize,
  IsIn,
  IsInt,
  IsDate,
  IsNotEmpty,
} from 'class-validator';
import { UUID } from '../../../common/types/uuid.type';

export class OpenShiftDTO {
  @ApiProperty({ example: 1000000 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  opening_balance!: number;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsOptional()
  @IsUUID()
  branch_id?: string;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsOptional()
  @IsUUID()
  warehouse_id?: string;
}

export class CloseShiftDTO {
  @ApiProperty({ example: 5000000 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  closing_balance!: number;
}

export class POSLineItemDTO {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  product_id!: UUID;

  @ApiProperty({ example: 2 })
  @IsNumber()
  @Min(0.0001)
  @Max(1000000)
  qty!: number;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  uom_id!: UUID;

  @ApiProperty({ example: 150000 })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  unit_price!: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  discount_pct?: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(0)
  version!: number;
}

export class PaymentMethodDTO {
  @ApiProperty({ example: 'CASH', enum: ['CASH', 'CARD', 'TRANSFER', 'EDC'] })
  @IsIn(['CASH', 'CARD', 'TRANSFER', 'EDC'])
  method!: 'CASH' | 'CARD' | 'TRANSFER' | 'EDC';

  @ApiProperty({ example: 300000 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount!: number;

  @ApiPropertyOptional({ example: 'REF-12345' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(0)
  version!: number;
}

export class CheckoutItemDTO {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  product_id!: UUID;

  @ApiProperty({ example: 2 })
  @IsNumber()
  @Min(0.0001)
  @Max(1000000)
  quantity!: number;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsOptional()
  @IsUUID()
  uom_id?: UUID;

  @ApiProperty({ example: 150000 })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  unit_price!: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  discount_pct?: number;
}

export class CheckoutPaymentDTO {
  @ApiProperty({ example: 'CASH', enum: ['CASH', 'CARD', 'TRANSFER', 'EDC'] })
  @IsIn(['CASH', 'CARD', 'TRANSFER', 'EDC'])
  method!: 'CASH' | 'CARD' | 'TRANSFER' | 'EDC';

  @ApiProperty({ example: 300000 })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount!: number;

  @ApiPropertyOptional({ example: 'REF-12345' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;
}

export class ProcessTransactionDTO {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  shift_id!: UUID;

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsOptional()
  @IsUUID()
  customer_id?: UUID;

  @ApiProperty({ type: [CheckoutItemDTO] })
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemDTO)
  @ArrayNotEmpty()
  @ArrayMaxSize(500)
  items!: CheckoutItemDTO[];

  @ApiProperty({ type: [CheckoutPaymentDTO] })
  @ValidateNested({ each: true })
  @Type(() => CheckoutPaymentDTO)
  @ArrayNotEmpty()
  @ArrayMaxSize(10)
  payments!: CheckoutPaymentDTO[];
}

export class VoidTransactionDTO {
  @ApiProperty({ example: 'Customer canceled' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  @Min(0)
  version?: number;
}

export class CreateSOLineDTO {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  product_id!: UUID;

  @ApiProperty({ example: 5 })
  @IsNumber()
  @Min(0.0001)
  @Max(1000000)
  qty!: number;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  uom_id!: UUID;

  @ApiProperty({ example: 200000 })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  unit_price!: number;
}

export class CreateSODTO {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  customer_id!: UUID;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  branch_id!: UUID;

  @ApiProperty({ example: '2026-08-01T00:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  order_date!: Date;

  @ApiProperty({ type: [CreateSOLineDTO] })
  @ValidateNested({ each: true })
  @Type(() => CreateSOLineDTO)
  @ArrayNotEmpty()
  @ArrayMaxSize(500)
  lines!: CreateSOLineDTO[];
}

export class FulfillmentLineDTO {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  so_line_id!: UUID;

  @ApiProperty({ example: 5 })
  @IsNumber()
  @Min(0.0001)
  @Max(1000000)
  qty_fulfilled!: number;
}

export class FulfillmentDTO {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  warehouse_id!: UUID;

  @ApiProperty({ example: '2026-08-05T00:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  delivery_date!: Date;

  @ApiProperty({ type: [FulfillmentLineDTO] })
  @ValidateNested({ each: true })
  @Type(() => FulfillmentLineDTO)
  @ArrayMaxSize(500)
  lines!: FulfillmentLineDTO[];
}

export class SalesReturnLineDTO {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  product_id!: UUID;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @Min(0.0001)
  @Max(1000000)
  qty!: number;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  uom_id!: UUID;

  @ApiProperty({ example: 200000 })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  unit_price!: number;
}

export class SalesReturnDTO {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  customer_id!: UUID;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  warehouse_id!: UUID;

  @ApiProperty({ example: 'POS' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  reference_type!: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  reference_id!: UUID;

  @ApiProperty({ example: '2026-08-10T00:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  return_date!: Date;

  @ApiProperty({ example: 'Barang rusak' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @ApiProperty({ type: [SalesReturnLineDTO] })
  @ValidateNested({ each: true })
  @Type(() => SalesReturnLineDTO)
  @ArrayNotEmpty()
  @ArrayMaxSize(500)
  lines!: SalesReturnLineDTO[];
}
