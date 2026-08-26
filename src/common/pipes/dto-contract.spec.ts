import { ValidationPipe, BadRequestException } from '@nestjs/common';
import type { ArgumentMetadata } from '@nestjs/common';

import { OpenShiftDTO, CloseShiftDTO, ProcessTransactionDTO, VoidTransactionDTO, SalesReturnDTO, CreateSODTO, FulfillmentDTO } from '../../modules/pos/dto/pos.dto';
import { CreateGoodsReceiptDTO } from '../../modules/purchase/dto/goods-receipt.dto';
import { CreatePurchaseRequestDTO, UpdatePurchaseRequestDTO } from '../../modules/purchase/dto/purchase-request.dto';
import { StockTransferDTO, StockAdjustmentDTO, StockOpnameInitiateDTO, StockOpnameRecordDTO } from '../../modules/inventory/dto/inventory.dto';
import { CreateSalesInvoiceDTO, CreatePaymentDTO, BankStatementDTO } from '../../modules/invoicing/dto/invoicing.dto';
import { CreatePeriodDTO, CreateJournalEntryDTO, ConfirmReconciliationDTO } from '../../modules/accounting/dto/accounting.dto';
import { CreateUserDTO, UpdateUserDTO, CreateRoleDTO, UpdateRoleDTO } from '../../modules/governance/dto/admin.dto';
import { ApproveRequestDTO, RejectRequestDTO } from '../../modules/governance/dto/approval.dto';
import { CreateProductDTO, ProductFilterDTO } from '../../modules/master-data/dto/product.dto';
import { CreateCustomerDTO, CustomerFilter } from '../../modules/master-data/dto/customer.dto';
import { CreateSupplierDTO } from '../../modules/master-data/dto/supplier.dto';
import { CreateWarehouseDTO, WarehouseFilterDTO, LockWarehouseDTO } from '../../modules/master-data/dto/warehouse.dto';
import { CreateBranchDTO, CreateHeadOfficeDTO } from '../../modules/master-data/dto/branch.dto';
import { CreateCOADTO, COAFilterDTO } from '../../modules/master-data/dto/coa.dto';
import { CreatePriceListDTO, UpdatePricesDTO, PriceListFilterDTO } from '../../modules/master-data/dto/price-list.dto';

const UUID = '123e4567-e89b-12d3-a456-426614174000';
const UUID2 = '223e4567-e89b-12d3-a456-426614174001';

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

const meta = (metatype: unknown): ArgumentMetadata => ({ type: 'body', metatype: metatype as any, data: '' });

function run(cls: unknown, payload: unknown) {
  return pipe.transform(payload as any, meta(cls));
}

describe('Global ValidationPipe contract against DTO classes (C-1 regression guard)', () => {
  const validCases: Array<[unknown, Record<string, unknown>, string]> = [
    [OpenShiftDTO, { opening_balance: 1000000, branch_id: UUID }, 'OpenShiftDTO'],
    [CloseShiftDTO, { closing_balance: 250000 }, 'CloseShiftDTO'],
    [
      ProcessTransactionDTO,
      {
        shift_id: UUID,
        items: [{ product_id: UUID, quantity: 2, unit_price: 15000 }],
        payments: [{ method: 'CASH', amount: 50000 }],
      },
      'ProcessTransactionDTO (frontend checkout shape)',
    ],
    [VoidTransactionDTO, { reason: 'Customer canceled' }, 'VoidTransactionDTO'],
    [
      SalesReturnDTO,
      {
        customer_id: UUID,
        warehouse_id: UUID2,
        reference_type: 'POS',
        reference_id: UUID,
        return_date: '2026-08-10T00:00:00.000Z',
        lines: [{ product_id: UUID, qty: 1, uom_id: UUID2, unit_price: 20000 }],
      },
      'SalesReturnDTO (no reason — optional)',
    ],
    [
      CreateSODTO,
      {
        customer_id: UUID,
        branch_id: UUID2,
        order_date: '2026-08-01',
        lines: [{ product_id: UUID, qty: 5, uom_id: UUID2, unit_price: 30000 }],
      },
      'CreateSODTO',
    ],
    [FulfillmentDTO, { warehouse_id: UUID, delivery_date: '2026-08-05', lines: [] }, 'FulfillmentDTO (empty lines allowed)'],
    [
      CreateGoodsReceiptDTO,
      {
        po_id: UUID,
        receipt_date: '2026-08-02',
        lines: [{ po_line_id: UUID2, product_id: UUID, qty_received: 10, uom_id: UUID, unit_cost: 15000 }],
      },
      'CreateGoodsReceiptDTO',
    ],
    [
      CreatePurchaseRequestDTO,
      {
        branch_id: UUID,
        warehouse_id: UUID2,
        lines: [{ product_id: UUID, qty_requested: 3, uom_id: UUID2 }],
      },
      'CreatePurchaseRequestDTO',
    ],
    [UpdatePurchaseRequestDTO, { notes: 'updated' }, 'UpdatePurchaseRequestDTO'],
    [
      StockTransferDTO,
      {
        from_warehouse_id: UUID,
        to_warehouse_id: UUID2,
        transfer_date: '2026-08-03',
        lines: [{ product_id: UUID, uom_id: UUID2, qty: 4, unit_cost: 12000 }],
      },
      'StockTransferDTO',
    ],
    [
      StockAdjustmentDTO,
      {
        warehouse_id: UUID,
        adjustment_date: '2026-08-04',
        reason: 'Selisih opname',
        lines: [{ product_id: UUID, uom_id: UUID2, qty_system: 100, qty_actual: 98, unit_cost: 9000 }],
      },
      'StockAdjustmentDTO',
    ],
    [StockOpnameInitiateDTO, { warehouse_id: UUID }, 'StockOpnameInitiateDTO'],
    [StockOpnameRecordDTO, { items: [{ product_id: UUID, qty_counted: 42 }] }, 'StockOpnameRecordDTO'],
    [
      CreateSalesInvoiceDTO,
      {
        customer_id: UUID,
        branch_id: UUID2,
        invoice_date: '2026-08-01',
        due_date: '2026-08-31',
        lines: [{ product_id: UUID, qty: 2, unit_price: 50000, tax_pct: 11 }],
      },
      'CreateSalesInvoiceDTO',
    ],
    [
      CreatePaymentDTO,
      { payment_type: 'RECEIPT', branch_id: UUID, payment_date: '2026-08-05', amount: 100000 },
      'CreatePaymentDTO',
    ],
    [
      BankStatementDTO,
      {
        bank_account_id: UUID,
        statement_date: '2026-08-31',
        opening_balance: 0,
        closing_balance: 150000,
        lines: [{ transaction_date: '2026-08-20', description: 'Transfer Masuk', amount: 150000, type: 'CREDIT' }],
      },
      'BankStatementDTO',
    ],
    [CreatePeriodDTO, { period_name: '2026-08', start_date: '2026-08-01', end_date: '2026-08-31' }, 'CreatePeriodDTO'],
    [
      CreateJournalEntryDTO,
      {
        entry_date: '2026-08-06',
        period_id: UUID,
        lines: [
          { account_id: UUID, debit: 100000, credit: 0 },
          { account_id: UUID2, debit: 0, credit: 100000 },
        ],
      },
      'CreateJournalEntryDTO',
    ],
    [ConfirmReconciliationDTO, { matches: [{ statementId: UUID, paymentId: UUID2 }] }, 'ConfirmReconciliationDTO'],
    [
      CreateUserDTO,
      { email: 'kasir@toko.id', full_name: 'Kasir Satu', password: 'S3curePass!', role_ids: [UUID] },
      'CreateUserDTO',
    ],
    [UpdateUserDTO, { full_name: 'Nama Baru', is_active: false }, 'UpdateUserDTO'],
    [CreateRoleDTO, { name: 'Supervisor_Toko', permission_ids: [] }, 'CreateRoleDTO'],
    [UpdateRoleDTO, { description: 'desc' }, 'UpdateRoleDTO'],
    [ApproveRequestDTO, { notes: 'OK' }, 'ApproveRequestDTO'],
    [RejectRequestDTO, { reason: 'Budget kurang' }, 'RejectRequestDTO'],
    [
      CreateProductDTO,
      { code: 'PRD-001', name: 'Produk Uji', category_id: UUID, uom_id: UUID2 },
      'CreateProductDTO',
    ],
    [
      CreateCustomerDTO,
      { code: 'CUST-001', name: 'PT Maju', email: 'a@b.co', credit_limit: 5000000 },
      'CreateCustomerDTO',
    ],
    [CreateSupplierDTO, { code: 'SUP-001', name: 'PT Sumber' }, 'CreateSupplierDTO'],
    [CreateWarehouseDTO, { code: 'WH-01', name: 'Gudang Utama', branch_id: UUID }, 'CreateWarehouseDTO'],
    [LockWarehouseDTO, { reason: 'Stock opname tahunan' }, 'LockWarehouseDTO'],
    [CreateHeadOfficeDTO, { code: 'HQ', name: 'Pusat' }, 'CreateHeadOfficeDTO'],
    [CreateBranchDTO, { code: 'BR-01', name: 'Cabang A', parent_id: UUID }, 'CreateBranchDTO'],
    [
      CreateCOADTO,
      { account_code: '1.001', account_name: 'Kas', account_type: 'ASSET', normal_balance: 'DEBIT' },
      'CreateCOADTO',
    ],
    [CreatePriceListDTO, { code: 'PL-01', name: 'Eceran', valid_from: '2026-01-01' }, 'CreatePriceListDTO'],
    [UpdatePricesDTO, { items: [{ product_id: UUID, unit_price: 17500 }] }, 'UpdatePricesDTO'],

    [ProductFilterDTO, { page: '2', per_page: '50', is_active: 'true' }, 'ProductFilterDTO (query strings)'],
    [CustomerFilter, { page: '1', per_page: '20', is_active: 'false' }, 'CustomerFilter (query strings)'],
    [WarehouseFilterDTO, { is_locked: 'false' }, 'WarehouseFilterDTO (query strings)'],
    [COAFilterDTO, { is_header: 'true' }, 'COAFilterDTO (query strings)'],
    [PriceListFilterDTO, { is_active: 'true' }, 'PriceListFilterDTO (query strings)'],
  ];

  it.each(validCases)('%s accepts its documented contract payload', async (cls, payload, label) => {
    await expect(run(cls, payload)).resolves.toBeDefined();
  });

  const invalidCases: Array<[unknown, Record<string, unknown>, string]> = [
    [ProcessTransactionDTO, { shift_id: UUID, items: [], payments: [{ method: 'CASH', amount: 1 }] }, 'empty items rejected'],
    [ProcessTransactionDTO, { shift_id: 'not-a-uuid', items: [{ product_id: UUID, quantity: 1, unit_price: 1 }], payments: [{ method: 'CASH', amount: 1 }] }, 'bad shift uuid rejected'],
    [ProcessTransactionDTO, { shift_id: UUID, items: [{ product_id: UUID, quantity: -5, unit_price: 1 }], payments: [{ method: 'CASH', amount: 1 }] }, 'negative qty rejected'],
    [ProcessTransactionDTO, { shift_id: UUID, items: [{ product_id: UUID, quantity: 1, unit_price: 1 }], payments: [{ method: 'PAYPAL', amount: 1 }] }, 'unknown payment method rejected'],
    [ProcessTransactionDTO, { shift_id: UUID, items: [{ product_id: UUID, quantity: 1, unit_price: 1, evil_extra: true }], payments: [{ method: 'CASH', amount: 1 }] }, 'non-whitelisted property rejected'],
    [SalesReturnDTO, { customer_id: UUID, warehouse_id: UUID, reference_type: 'POS', reference_id: UUID, return_date: '2026-08-10', lines: [{ product_id: UUID, qty: 99999999999, uom_id: UUID, unit_price: 1 }] }, 'absurd qty rejected by max-size guards'],
    [OpenShiftDTO, { opening_balance: -100 }, 'negative opening balance rejected'],
    [VoidTransactionDTO, {}, 'missing void reason rejected'],
    [CreateGoodsReceiptDTO, { po_id: UUID, receipt_date: 'not-a-date', lines: [] }, 'bad date rejected'],
    [CreateUserDTO, { email: 'x@y.z', full_name: 'X', password: 'short', role_ids: [UUID] }, 'weak password rejected'],
    [CreateUserDTO, { email: 'x@y.z', full_name: 'X', password: 'LongEnoughPass1!' }, 'missing role_ids rejected'],
    [CreatePeriodDTO, { period_name: '', start_date: '2026-08-01', end_date: '2026-08-31' }, 'empty period name rejected'],
    [CreateCOADTO, { account_code: 'INVALID!!', account_name: 'X', account_type: 'ASSET', normal_balance: 'DEBIT' }, 'invalid account code rejected'],
    [CreateCOADTO, { account_code: '1.001', account_name: 'X', account_type: 'NOT_A_TYPE', normal_balance: 'DEBIT' }, 'invalid account type rejected'],
    [UpdatePricesDTO, { items: [{ product_id: UUID, unit_price: -1 }] }, 'negative price rejected'],
  ];

  it.each(invalidCases)('%s', async (cls, payload, label) => {
    await expect(run(cls, payload)).rejects.toThrow(BadRequestException);
  });

  it('transforms ISO date strings into Date instances for services', async () => {
    const out = (await run(CreateSODTO, {
      customer_id: UUID,
      branch_id: UUID2,
      order_date: '2026-08-01T00:00:00.000Z',
      lines: [{ product_id: UUID, qty: 5, uom_id: UUID2, unit_price: 30000 }],
    })) as CreateSODTO;
    expect(out.order_date).toBeInstanceOf(Date);
  });

  it('parses query booleans correctly ("false" stays false)', async () => {
    const out = (await run(CustomerFilter, { is_active: 'false', page: '2' })) as CustomerFilter;
    expect(out.is_active).toBe(false);
    expect(out.page).toBe(2);
  });
});
