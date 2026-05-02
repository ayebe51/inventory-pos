import { UUID } from '../../../common/types/uuid.type';

/**
 * DTO for creating a new Goods Receipt
 */
export interface CreateGoodsReceiptDTO {
  po_id: UUID;
  receipt_date: Date | string;
  notes?: string;
  lines: CreateGoodsReceiptLineDTO[];
}

/**
 * DTO for Goods Receipt line item
 */
export interface CreateGoodsReceiptLineDTO {
  po_line_id: UUID;
  product_id: UUID;
  qty_received: number;
  unit_cost: number;
  notes?: string;
}

/**
 * DTO for confirming a Goods Receipt
 */
export interface ConfirmGoodsReceiptDTO {
  confirmed_by?: UUID; // Optional, will be set from JWT
}

/**
 * DTO for searching Goods Receipts
 */
export interface SearchGoodsReceiptDTO {
  gr_number?: string;
  po_id?: UUID;
  supplier_id?: UUID;
  warehouse_id?: UUID;
  status?: 'DRAFT' | 'CONFIRMED';
  date_from?: string;
  date_to?: string;
  page?: number;
  per_page?: number;
}
