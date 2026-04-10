import { UUID } from '../../../common/types/uuid.type';

export type POStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'PARTIALLY_RECEIVED'
  | 'FULLY_RECEIVED'
  | 'CANCELLED'
  | 'CLOSED';

export type ApprovalLevel = 1 | 2 | 3;

export type OverReceiptPolicy = 'REJECT' | 'ACCEPT_WITH_TOLERANCE';

export interface PurchaseOrder {
  id: UUID;
  po_number: string;
  pr_id: UUID | null;
  supplier_id: UUID;
  branch_id: UUID;
  warehouse_id: UUID;
  status: POStatus;
  order_date: Date;
  expected_delivery_date: Date | null;
  currency: string;
  exchange_rate: number;
  subtotal: number;
  tax_amount: number;
  additional_cost: number;
  total_amount: number;
  approval_level: number;
  approved_by: UUID | null;
  approved_at: Date | null;
  notes: string | null;
  terms_of_payment_id: UUID | null;
  created_by: UUID;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface GoodsReceipt {
  id: UUID;
  gr_number: string;
  po_id: UUID;
  supplier_id: UUID;
  warehouse_id: UUID;
  receipt_date: Date;
  status: 'DRAFT' | 'CONFIRMED';
  total_amount: number;
  notes: string | null;
  confirmed_by: UUID | null;
  confirmed_at: Date | null;
  created_by: UUID;
  created_at: Date;
  updated_at: Date;
}

export interface CreatePODTO {
  supplier_id: UUID;
  branch_id: UUID;
  warehouse_id: UUID;
  order_date: Date;
  expected_delivery_date?: Date;
  notes?: string;
  lines: CreatePOLineDTO[];
}

export interface CreatePOLineDTO {
  product_id: UUID;
  qty_ordered: number;
  uom_id: UUID;
  unit_price: number;
  discount_pct?: number;
  tax_pct?: number;
}

export interface GoodsReceiptDTO {
  receipt_date: Date;
  lines: GoodsReceiptLineDTO[];
}

export interface GoodsReceiptLineDTO {
  po_line_id: UUID;
  product_id: UUID;
  qty_received: number;
  unit_cost: number;
}

export interface CreateGRDTO extends GoodsReceiptDTO {}

export interface PurchaseOrderService {
  create(data: CreatePODTO): Promise<PurchaseOrder>;
  submit(id: UUID, userId: UUID): Promise<PurchaseOrder>;
  approve(id: UUID, approverId: UUID, notes?: string): Promise<PurchaseOrder>;
  reject(id: UUID, approverId: UUID, reason: string): Promise<PurchaseOrder>;
  cancel(id: UUID, userId: UUID, reason: string): Promise<PurchaseOrder>;
  receiveGoods(id: UUID, data: GoodsReceiptDTO): Promise<GoodsReceipt>;
  getApprovalThreshold(amount: number): ApprovalLevel;
}

export interface GoodsReceiptService {
  create(poId: UUID, data: CreateGRDTO): Promise<GoodsReceipt>;
  confirm(id: UUID, userId: UUID): Promise<GoodsReceipt>;
  handleOverReceipt(grId: UUID, policy: OverReceiptPolicy): Promise<void>;
  updateAverageCost(productId: UUID, warehouseId: UUID, newQty: number, newCost: number): Promise<void>;
}
