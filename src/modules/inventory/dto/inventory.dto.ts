import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UUID } from '../../../common/types/uuid.type';

export class StockTransferLineDTO {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  product_id!: UUID;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  uom_id!: UUID;

  @ApiProperty({ example: 10 })
  qty!: number;

  @ApiProperty({ example: 50000 })
  unit_cost!: number;
}

export class StockTransferDTO {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  from_warehouse_id!: UUID;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174001' })
  to_warehouse_id!: UUID;

  @ApiProperty({ example: '2026-08-01T00:00:00.000Z' })
  transfer_date!: Date;

  @ApiProperty({ type: [StockTransferLineDTO] })
  lines!: StockTransferLineDTO[];

  @ApiPropertyOptional({ example: '123e4567-e89b-12d3-a456-426614174000' })
  created_by?: UUID;
}

export class StockAdjustmentLineDTO {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  product_id!: UUID;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  uom_id!: UUID;

  @ApiProperty({ example: 100 })
  qty_system!: number;

  @ApiProperty({ example: 98 })
  qty_actual!: number;

  @ApiProperty({ example: 50000 })
  unit_cost!: number;
}

export class StockAdjustmentDTO {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  warehouse_id!: UUID;

  @ApiProperty({ example: '2026-08-01T00:00:00.000Z' })
  adjustment_date!: Date;

  @ApiProperty({ example: 'Selisih stock opname' })
  reason!: string;

  @ApiProperty({ type: [StockAdjustmentLineDTO] })
  lines!: StockAdjustmentLineDTO[];
}

export class StockOpnameInitiateDTO {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  warehouse_id!: UUID;
}

export class StockOpnameRecordItemDTO {
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  product_id!: UUID;

  @ApiProperty({ example: 100 })
  qty_counted!: number;
}

export class StockOpnameRecordDTO {
  @ApiProperty({ type: [StockOpnameRecordItemDTO] })
  items!: StockOpnameRecordItemDTO[];
}
