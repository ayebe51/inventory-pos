import { UUID } from '../../../common/types/uuid.type';

export type InventoryTransactionType =
  | 'GR'
  | 'SO'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'ADJUSTMENT'
  | 'OPNAME'
  | 'RETURN_IN'
  | 'RETURN_OUT';

export type StockStatus =
  | 'AVAILABLE'
  | 'RESERVED'
  | 'COMMITTED'
  | 'DAMAGED'
  | 'QUARANTINE'
  | 'FROZEN'
  | 'IN_TRANSIT';

export interface StockBalance {
  product_id: UUID;
  warehouse_id: UUID;
  qty_available: number;
  qty_reserved: number;
  qty_committed: number;
  qty_damaged: number;
  qty_quarantine: number;
  qty_in_transit: number;
  average_cost: number;
  total_value: number;
}

export interface InventoryLedgerEntry {
  id: UUID;
  product_id: UUID;
  warehouse_id: UUID;
  transaction_type: InventoryTransactionType;
  reference_type: string;
  reference_id: UUID;
  reference_number: string;
  movement_date: Date;
  qty_in: number;
  qty_out: number;
  unit_cost: number;
  total_cost: number;
  running_qty: number;
  running_cost: number;
  batch_number: string | null;
  serial_number: string | null;
  notes: string | null;
  created_by: UUID;
  created_at: Date;
}

export interface StockTransfer {
  id: UUID;
  transfer_number: string;
  from_warehouse_id: UUID;
  to_warehouse_id: UUID;
  status: 'DRAFT' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED';
  transfer_date: Date;
  created_by: UUID;
  created_at: Date;
  updated_at: Date;
}

export interface StockAdjustment {
  id: UUID;
  adjustment_number: string;
  warehouse_id: UUID;
  adjustment_date: Date;
  reason: string;
  status: 'DRAFT' | 'POSTED';
  created_by: UUID;
  created_at: Date;
  updated_at: Date;
}

export interface StockOpname {
  id: UUID;
  opname_number: string;
  warehouse_id: UUID;
  status: 'INITIATED' | 'IN_PROGRESS' | 'COMPLETED';
  initiated_by: UUID;
  initiated_at: Date;
  completed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface StockMovementDTO {
  product_id: UUID;
  warehouse_id: UUID;
  transaction_type: InventoryTransactionType;
  reference_type: string;
  reference_id: UUID;
  reference_number: string;
  movement_date: Date;
  qty_in: number;
  qty_out: number;
  unit_cost: number;
  notes?: string;
  created_by: UUID;
}

export interface StockTransferDTO {
  from_warehouse_id: UUID;
  to_warehouse_id: UUID;
  transfer_date: Date;
  lines: StockTransferLineDTO[];
  created_by: UUID;
}

export interface StockTransferLineDTO {
  product_id: UUID;
  qty: number;
  unit_cost: number;
}

export interface StockAdjustmentDTO {
  warehouse_id: UUID;
  adjustment_date: Date;
  reason: string;
  lines: StockAdjustmentLineDTO[];
}

export interface StockAdjustmentLineDTO {
  product_id: UUID;
  qty_system: number;
  qty_actual: number;
  unit_cost: number;
}

export interface CountItem {
  product_id: UUID;
  qty_counted: number;
  batch_number?: string;
  serial_number?: string;
}

export interface InventoryService {
  getStockBalance(productId: UUID, warehouseId: UUID): Promise<StockBalance>;
  recordMovement(data: StockMovementDTO): Promise<InventoryLedgerEntry>;
  transferStock(data: StockTransferDTO): Promise<StockTransfer>;
  adjustStock(data: StockAdjustmentDTO, userId: UUID): Promise<StockAdjustment>;
  lockWarehouse(warehouseId: UUID, reason: string): Promise<void>;
  calculateAverageCost(productId: UUID, warehouseId: UUID): Promise<number>;
}

export interface StockOpnameService {
  initiate(warehouseId: UUID, userId: UUID): Promise<StockOpname>;
  recordCount(opnameId: UUID, items: CountItem[]): Promise<void>;
  requestRecount(opnameId: UUID, items: UUID[]): Promise<void>;
  finalize(opnameId: UUID, userId: UUID): Promise<StockAdjustment>;
}
