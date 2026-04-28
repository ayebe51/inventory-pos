import { UUID } from '../../../common/types/uuid.type';
import { PaginatedResult } from '../../../common/types/pagination.type';
import { AccountType } from '../dto/coa.dto';

export type BranchType = 'HEAD_OFFICE' | 'BRANCH';

export interface Branch {
  id: UUID;
  code: string;
  name: string;
  type: BranchType;
  parent_id: UUID | null;
  address: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface BranchNode extends Branch {
  children: BranchNode[];
}

export interface Product {
  id: UUID;
  code: string;
  barcode: string | null;
  name: string;
  description: string | null;
  category_id: UUID;
  brand_id: UUID | null;
  uom_id: UUID;
  uom_purchase_id: UUID | null;
  uom_sales_id: UUID | null;
  cost_method: 'WAC' | 'FIFO';
  standard_cost: number;
  selling_price: number;
  min_selling_price: number;
  reorder_point: number;
  reorder_qty: number;
  max_stock: number | null;
  is_serialized: boolean;
  is_batch_tracked: boolean;
  is_active: boolean;
  tax_category: string | null;
  weight: number | null;
  volume: number | null;
  image_url: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface Warehouse {
  id: UUID;
  code: string;
  name: string;
  branch_id: UUID;
  address: string | null;
  is_active: boolean;
  is_locked: boolean;
  lock_reason: string | null;
  locked_at: Date | null;
  locked_by: UUID | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface PriceList {
  id: UUID;
  code: string;
  name: string;
  customer_id: UUID | null;
  is_active: boolean;
  valid_from: Date;
  valid_to: Date | null;
  created_at: Date;
  updated_at: Date;
}

export type PriceSource = 'PRICE_LIST_CUSTOMER' | 'PRICE_LIST_GENERAL' | 'PRODUCT_DEFAULT';

export interface PriceResult {
  price: number;
  /** null when source is PRODUCT_DEFAULT */
  price_list_id: UUID | null;
  source: PriceSource;
}

export interface PriceItem {
  product_id: UUID;
  unit_price: number;
}

export interface ProductFilter {
  search?: string;
  category_id?: UUID;
  is_active?: boolean;
  page?: number;
  per_page?: number;
}

export interface CreateProductDTO {
  code: string;
  name: string;
  category_id: UUID;
  uom_id: UUID;
  cost_method: 'WAC' | 'FIFO';
  standard_cost: number;
  selling_price: number;
  min_selling_price: number;
}

export interface UpdateProductDTO extends Partial<CreateProductDTO> {}

export interface CreateWarehouseDTO {
  code: string;
  name: string;
  branch_id: UUID;
  address?: string;
}

export interface CreatePriceListDTO {
  code: string;
  name: string;
  customer_id?: UUID | null;
  valid_from: Date;
  valid_to?: Date | null;
  is_active?: boolean;
}

export interface ProductService {
  create(data: CreateProductDTO): Promise<Product>;
  update(id: UUID, data: UpdateProductDTO): Promise<Product>;
  findById(id: UUID): Promise<Product>;
  search(filters: ProductFilter): Promise<PaginatedResult<Product>>;
  deactivate(id: UUID): Promise<void>;
}

export interface WarehouseService {
  create(data: CreateWarehouseDTO): Promise<Warehouse>;
  findByBranch(branchId: UUID): Promise<Warehouse[]>;
  lock(id: UUID, reason: string): Promise<void>;
  unlock(id: UUID): Promise<void>;
}

export interface PriceListService {
  getActivePrice(productId: UUID, customerId: UUID | null, date: Date): Promise<PriceResult>;
  createPriceList(data: CreatePriceListDTO): Promise<PriceList>;
  updatePrices(priceListId: UUID, items: PriceItem[]): Promise<void>;
}

// ── Chart of Accounts ─────────────────────────────────────────────────────────

export interface ChartOfAccount {
  id: UUID;
  account_code: string;
  account_name: string;
  account_type: AccountType;
  account_category: string | null;
  parent_id: UUID | null;
  level: number;
  is_header: boolean;
  normal_balance: 'DEBIT' | 'CREDIT';
  is_active: boolean;
  is_system: boolean;
  branch_id: UUID | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface ChartOfAccountNode extends ChartOfAccount {
  children: ChartOfAccountNode[];
}
