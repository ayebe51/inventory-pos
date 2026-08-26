import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsUUID,
  IsNumber,
  IsOptional,
  IsString,
  IsNotEmpty,
  IsDate,
  Min,
  MaxLength,
  ValidateNested,
  ArrayMaxSize,
} from 'class-validator';
import { UUID } from '../../../common/types/uuid.type';

export class StockTransferLineDTO {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  product_id!: UUID;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  uom_id!: UUID;

  @ApiProperty({ example: 10 })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  qty!: number;

  @ApiProperty({ example: 50000 })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  unit_cost!: number;
}

export class StockTransferDTO {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  from_warehouse_id!: UUID;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174001' })
  @IsUUID()
  to_warehouse_id!: UUID;

  @ApiProperty({ example: '2026-08-01T00:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  transfer_date!: Date;

  @ApiProperty({ type: [StockTransferLineDTO] })
  @ValidateNested({ each: true })
  @Type(() => StockTransferLineDTO)
  @ArrayMaxSize(500)
  lines!: StockTransferLineDTO[];

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsOptional()
  @IsUUID()
  created_by?: UUID;
}

export class StockAdjustmentLineDTO {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  product_id!: UUID;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  uom_id!: UUID;

  @ApiProperty({ example: 100 })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  qty_system!: number;

  @ApiProperty({ example: 98 })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  qty_actual!: number;

  @ApiProperty({ example: 50000 })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  unit_cost!: number;
}

export class StockAdjustmentDTO {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  warehouse_id!: UUID;

  @ApiProperty({ example: '2026-08-01T00:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  adjustment_date!: Date;

  @ApiProperty({ example: 'Selisih stock opname' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;

  @ApiProperty({ type: [StockAdjustmentLineDTO] })
  @ValidateNested({ each: true })
  @Type(() => StockAdjustmentLineDTO)
  @ArrayMaxSize(1000)
  lines!: StockAdjustmentLineDTO[];
}

export class StockOpnameInitiateDTO {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  warehouse_id!: UUID;
}

export class StockOpnameRecordItemDTO {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  product_id!: UUID;

  @ApiProperty({ example: 100 })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  qty_counted!: number;
}

export class StockOpnameRecordDTO {
  @ApiProperty({ type: [StockOpnameRecordItemDTO] })
  @ValidateNested({ each: true })
  @Type(() => StockOpnameRecordItemDTO)
  @ArrayMaxSize(2000)
  items!: StockOpnameRecordItemDTO[];
}
