import { UUID } from '../../../common/types/uuid.type';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsUUID,
  IsNumber,
  IsOptional,
  IsString,
  IsDate,
  IsIn,
  IsInt,
  Min,
  Max,
  MaxLength,
  ValidateNested,
  ArrayNotEmpty,
  ArrayMaxSize,
} from 'class-validator';

/**
 * DTO for Goods Receipt line item
 */
export class CreateGoodsReceiptLineDTO {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  po_line_id!: UUID;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  product_id!: UUID;

  @ApiProperty({ example: 100 })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  qty_received!: number;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  uom_id!: UUID;

  @ApiProperty({ example: 150000 })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  unit_cost!: number;

  @ApiPropertyOptional({ example: 'Kondisi baik' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

/**
 * DTO for creating a new Goods Receipt
 */
export class CreateGoodsReceiptDTO {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  po_id!: UUID;

  @ApiProperty({ example: '2026-08-01T00:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  receipt_date!: Date;

  @ApiPropertyOptional({ example: 'Pengiriman batch 1' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiProperty({ type: [CreateGoodsReceiptLineDTO] })
  @ValidateNested({ each: true })
  @Type(() => CreateGoodsReceiptLineDTO)
  @ArrayNotEmpty()
  @ArrayMaxSize(500)
  lines!: CreateGoodsReceiptLineDTO[];
}

/**
 * DTO for confirming a Goods Receipt
 */
export class ConfirmGoodsReceiptDTO {
  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsOptional()
  @IsUUID()
  confirmed_by?: UUID;
}

/**
 * DTO for searching Goods Receipts
 */
export class SearchGoodsReceiptDTO {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(30)
  gr_number?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  po_id?: UUID;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  supplier_id?: UUID;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  warehouse_id?: UUID;

  @ApiPropertyOptional({ enum: ['DRAFT', 'CONFIRMED'] })
  @IsOptional()
  @IsIn(['DRAFT', 'CONFIRMED'])
  status?: 'DRAFT' | 'CONFIRMED';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  date_from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  date_to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  per_page?: number;
}
