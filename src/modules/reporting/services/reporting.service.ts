import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaReadService } from '../../../config/prisma-read.service';
import {
  ReportingService as IReportingService,
  DashboardParams,
  TrialBalanceParams,
  PeriodParams,
  AsOfDateParams,
  AgingParams,
  StockParams,
  MovementParams,
  SalesParams,
  ExecutiveDashboard,
  TrialBalanceReport,
  IncomeStatement,
  BalanceSheet,
  CashFlowStatement,
  ARAgingReport,
  APAgingReport,
  StockPositionReport,
  StockMovementReport,
  SalesReport,
  ShiftReport,
  RecentActivityItem,
} from '../interfaces/reporting.interfaces';
import { UUID } from '../../../common/types/uuid.type';

@Injectable()
export class ReportingService implements IReportingService {
  constructor(private readonly prisma: PrismaReadService) {}

  async getExecutiveDashboard(params: DashboardParams): Promise<ExecutiveDashboard> {
    const asOfDate = params.as_of_date || new Date();
    
    // Total Sales (POS Completed + Sales Invoices Posted/Paid)
    const posSalesResult = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT COALESCE(SUM(total_amount), 0) as total
      FROM pos_transactions
      WHERE status = 'COMPLETED' AND transaction_date <= $1
      ${params.branch_id ? `AND shift_id IN (SELECT id FROM shifts WHERE branch_id = '${params.branch_id}')` : ''}
    `, asOfDate);
    
    const invoiceSalesResult = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT COALESCE(SUM(total_amount), 0) as total
      FROM invoices
      WHERE invoice_type = 'SALES' AND status IN ('POSTED', 'PAID') AND invoice_date <= $1
      ${params.branch_id ? `AND branch_id = '${params.branch_id}'` : ''}
    `, asOfDate);

    const total_sales = Number(posSalesResult[0]?.total || 0) + Number(invoiceSalesResult[0]?.total || 0);

    // Total Purchases (Purchase Invoices Posted/Paid)
    const purchaseResult = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT COALESCE(SUM(total_amount), 0) as total
      FROM invoices
      WHERE invoice_type = 'PURCHASE' AND status IN ('POSTED', 'PAID') AND invoice_date <= $1
      ${params.branch_id ? `AND branch_id = '${params.branch_id}'` : ''}
    `, asOfDate);
    const total_purchases = Number(purchaseResult[0]?.total || 0);

    // AR and AP Outstanding
    const outstandingResult = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT 
        SUM(CASE WHEN invoice_type = 'SALES' THEN outstanding_amount ELSE 0 END) as ar_total,
        SUM(CASE WHEN invoice_type = 'PURCHASE' THEN outstanding_amount ELSE 0 END) as ap_total
      FROM invoices
      WHERE status IN ('POSTED', 'PARTIAL') AND invoice_date <= $1
      ${params.branch_id ? `AND branch_id = '${params.branch_id}'` : ''}
    `, asOfDate);
    
    const ar_outstanding = Number(outstandingResult[0]?.ar_total || 0);
    const ap_outstanding = Number(outstandingResult[0]?.ap_total || 0);

    const cashResult = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT 
        COALESCE(SUM(CASE WHEN c.normal_balance = 'DEBIT' THEN l.debit - l.credit ELSE l.credit - l.debit END), 0) as balance
      FROM journal_entry_lines l
      JOIN journal_entries j ON l.je_id = j.id
      JOIN chart_of_accounts c ON l.account_id = c.id
      WHERE j.status = 'POSTED' AND j.entry_date <= $1 AND c.account_type IN ('CASH', 'BANK', 'CASH_AND_BANK')
      ${params.branch_id ? `AND c.branch_id = '${params.branch_id}'` : ''}
    `, asOfDate);
    const cash_position = Number(cashResult[0]?.balance || 0);

    // Inventory Value & Low Stock
    const inventoryResult = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT 
        SUM(running_cost) as total_value,
        SUM(CASE WHEN running_qty <= 5 THEN 1 ELSE 0 END) as low_stock_count
      FROM (
        SELECT running_qty, running_cost,
               ROW_NUMBER() OVER (PARTITION BY product_id, warehouse_id ORDER BY movement_date DESC, created_at DESC) as rn
        FROM inventory_ledger
        WHERE movement_date <= $1
      ) last_ledger
      WHERE rn = 1 AND running_qty > 0
    `, asOfDate);
    const inventory_value = Number(inventoryResult[0]?.total_value || 0);
    const low_stock_alerts = Number(inventoryResult[0]?.low_stock_count || 0);

    // Top Products
    const topProductsResult = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT p.id, p.name, SUM(l.qty) as total_qty, SUM(l.line_total) as total_revenue
      FROM pos_transaction_lines l
      JOIN pos_transactions t ON l.transaction_id = t.id
      JOIN products p ON l.product_id = p.id
      WHERE t.status = 'COMPLETED' AND t.transaction_date <= $1
      GROUP BY p.id, p.name
      ORDER BY total_qty DESC
      LIMIT 5
    `, asOfDate);

    return {
      total_sales,
      total_purchases,
      cash_position,
      ar_outstanding,
      ap_outstanding,
      inventory_value,
      low_stock_alerts,
      top_products: topProductsResult.map(r => ({
        product_id: r.id,
        product_name: r.name,
        total_qty: Number(r.total_qty),
        total_revenue: Number(r.total_revenue)
      })),
      generated_at: new Date(),
    };
  }

  async getTrialBalance(params: TrialBalanceParams): Promise<TrialBalanceReport> {
    // Aggregation of journal_entry_line based on period_id
    const result = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT 
        c.account_code, 
        c.account_name, 
        COALESCE(SUM(l.debit), 0) as debit_balance, 
        COALESCE(SUM(l.credit), 0) as credit_balance
      FROM chart_of_accounts c
      LEFT JOIN journal_entry_lines l ON c.id = l.account_id
      LEFT JOIN journal_entries j ON l.je_id = j.id
      WHERE j.period_id = $1 AND j.status = 'POSTED'
      GROUP BY c.account_code, c.account_name
      ORDER BY c.account_code ASC
    `, params.period_id);

    let totalDebit = 0;
    let totalCredit = 0;
    const accounts = result.map(r => {
      totalDebit += Number(r.debit_balance);
      totalCredit += Number(r.credit_balance);
      return {
        account_code: r.account_code,
        account_name: r.account_name,
        debit_balance: Number(r.debit_balance),
        credit_balance: Number(r.credit_balance),
      };
    });

    return {
      period_id: params.period_id,
      accounts,
      total_debit: totalDebit,
      total_credit: totalCredit,
    };
  }

  async getIncomeStatement(params: PeriodParams): Promise<IncomeStatement> {
    const result = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT 
        c.account_type,
        SUM(CASE WHEN c.normal_balance = 'CREDIT' THEN l.credit - l.debit ELSE l.debit - l.credit END) as balance
      FROM chart_of_accounts c
      JOIN journal_entry_lines l ON c.id = l.account_id
      JOIN journal_entries j ON l.je_id = j.id
      WHERE j.period_id = $1 AND j.status = 'POSTED'
        AND c.account_type IN ('REVENUE', 'COGS', 'EXPENSE')
      GROUP BY c.account_type
    `, params.period_id);

    let revenue = 0;
    let cogs = 0;
    let operating_expenses = 0;

    result.forEach(r => {
      const balance = Number(r.balance || 0);
      if (r.account_type === 'REVENUE') revenue += balance;
      if (r.account_type === 'COGS') cogs += balance;
      if (r.account_type === 'EXPENSE') operating_expenses += balance;
    });

    const gross_profit = revenue - cogs;
    const net_income = gross_profit - operating_expenses;

    return {
      period_id: params.period_id,
      revenue,
      cogs,
      gross_profit,
      operating_expenses,
      net_income,
    };
  }

  async getBalanceSheet(params: AsOfDateParams): Promise<BalanceSheet> {
    const result = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT 
        c.account_type,
        SUM(CASE WHEN c.normal_balance = 'DEBIT' THEN l.debit - l.credit ELSE l.credit - l.debit END) as balance
      FROM chart_of_accounts c
      JOIN journal_entry_lines l ON c.id = l.account_id
      JOIN journal_entries j ON l.je_id = j.id
      WHERE j.entry_date <= $1 AND j.status = 'POSTED'
        AND c.account_type IN ('ASSET', 'LIABILITY', 'EQUITY')
      GROUP BY c.account_type
    `, params.as_of_date);

    let assets = 0;
    let liabilities = 0;
    let equity = 0;

    result.forEach(r => {
      const balance = Number(r.balance || 0);
      if (r.account_type === 'ASSET') assets += balance;
      if (r.account_type === 'LIABILITY') liabilities += balance;
      if (r.account_type === 'EQUITY') equity += balance;
    });

    return {
      as_of_date: params.as_of_date,
      total_assets: assets,
      total_liabilities: liabilities,
      total_equity: equity,
    };
  }

  async getCashFlow(params: PeriodParams): Promise<CashFlowStatement> {
    const result = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT 
        SUM(CASE WHEN l.debit > l.credit THEN l.debit - l.credit ELSE 0 END) as cash_in,
        SUM(CASE WHEN l.credit > l.debit THEN l.credit - l.debit ELSE 0 END) as cash_out
      FROM journal_entry_lines l
      JOIN journal_entries j ON l.je_id = j.id
      JOIN chart_of_accounts c ON l.account_id = c.id
      WHERE j.period_id = $1 AND j.status = 'POSTED'
        AND c.account_type IN ('CASH', 'BANK', 'CASH_AND_BANK')
    `, params.period_id);

    const cash_in = Number(result[0]?.cash_in || 0);
    const cash_out = Number(result[0]?.cash_out || 0);
    const net_operating = cash_in - cash_out;

    return {
      period_id: params.period_id,
      operating_activities: net_operating,
      investing_activities: 0,
      financing_activities: 0,
      net_cash_flow: net_operating,
    };
  }

  async getARAgingReport(params: AgingParams): Promise<ARAgingReport> {
    // Calculate aging buckets for AR (Sales Invoices)
    const asOf = params.as_of_date.toISOString();
    const result = await this.prisma.$queryRawUnsafe<any[]>(`
      WITH buckets AS (
        SELECT 
          id,
          outstanding_balance,
          DATE_PART('day', $1::timestamp - due_date) as days_overdue
        FROM invoices
        WHERE type = 'SALES' AND status NOT IN ('PAID', 'CANCELLED', 'WRITTEN_OFF')
          AND invoice_date <= $1::timestamp
      )
      SELECT 
        CASE 
          WHEN days_overdue <= 0 THEN 'CURRENT'
          WHEN days_overdue BETWEEN 1 AND 30 THEN '1-30'
          WHEN days_overdue BETWEEN 31 AND 60 THEN '31-60'
          WHEN days_overdue BETWEEN 61 AND 90 THEN '61-90'
          ELSE '>90'
        END as bucket,
        COUNT(id) as invoice_count,
        SUM(outstanding_balance) as total_amount
      FROM buckets
      GROUP BY 1
    `, params.as_of_date);

    const mappedBuckets = result.map(r => ({
      label: r.bucket,
      count: Number(r.invoice_count),
      amount: Number(r.total_amount),
    }));

    return {
      as_of_date: params.as_of_date,
      buckets: mappedBuckets as any,
      total_outstanding: mappedBuckets.reduce((sum, b) => sum + b.amount, 0),
    };
  }

  async getAPAgingReport(params: AgingParams): Promise<APAgingReport> {
    // Calculate aging buckets for AP (Purchase Invoices)
    const result = await this.prisma.$queryRawUnsafe<any[]>(`
      WITH buckets AS (
        SELECT 
          id,
          outstanding_balance,
          DATE_PART('day', $1::timestamp - due_date) as days_overdue
        FROM invoices
        WHERE type = 'PURCHASE' AND status NOT IN ('PAID', 'CANCELLED', 'WRITTEN_OFF')
          AND invoice_date <= $1::timestamp
      )
      SELECT 
        CASE 
          WHEN days_overdue <= 0 THEN 'CURRENT'
          WHEN days_overdue BETWEEN 1 AND 30 THEN '1-30'
          WHEN days_overdue BETWEEN 31 AND 60 THEN '31-60'
          WHEN days_overdue BETWEEN 61 AND 90 THEN '61-90'
          ELSE '>90'
        END as bucket,
        COUNT(id) as invoice_count,
        SUM(outstanding_balance) as total_amount
      FROM buckets
      GROUP BY 1
    `, params.as_of_date);

    const mappedBuckets = result.map(r => ({
      label: r.bucket,
      count: Number(r.invoice_count),
      amount: Number(r.total_amount),
    }));

    return {
      as_of_date: params.as_of_date,
      buckets: mappedBuckets as any,
      total_outstanding: mappedBuckets.reduce((sum, b) => sum + b.amount, 0),
    };
  }

  async getStockPositionReport(params: StockParams): Promise<StockPositionReport> {
    const asOf = params.as_of_date || new Date();
    // Query inventory ledger for stock position
    const result = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT 
        p.id as product_id,
        p.code as product_code,
        p.name as product_name,
        w.id as warehouse_id,
        w.name as warehouse_name,
        COALESCE(SUM(l.qty_in) - SUM(l.qty_out), 0) as qty_on_hand,
        COALESCE(SUM(l.total_cost), 0) as total_value
      FROM products p
      CROSS JOIN warehouses w
      LEFT JOIN inventory_ledger l ON p.id = l.product_id AND w.id = l.warehouse_id AND l.movement_date <= $1::timestamp
      WHERE ($2::uuid IS NULL OR w.id = $2::uuid)
      GROUP BY p.id, p.code, p.name, w.id, w.name
      HAVING COALESCE(SUM(l.qty_in) - SUM(l.qty_out), 0) > 0
    `, asOf, params.warehouse_id || null);

    return {
      as_of_date: asOf,
      items: result.map(r => {
        const qty = Number(r.qty_on_hand);
        const val = Number(r.total_value);
        return {
          product_id: r.product_id,
          product_code: r.product_code,
          product_name: r.product_name,
          warehouse_id: r.warehouse_id,
          warehouse_name: r.warehouse_name,
          qty_on_hand: qty,
          average_cost: qty > 0 ? val / qty : 0,
          total_value: val,
        };
      })
    };
  }

  async getStockMovementReport(params: MovementParams): Promise<StockMovementReport> {
    const movements = await this.prisma.inventoryLedger.findMany({
      where: {
        product_id: params.product_id,
        warehouse_id: params.warehouse_id,
        movement_date: {
          gte: params.from_date,
          lte: params.to_date,
        },
      },
      include: {
        product: true,
      },
      orderBy: {
        movement_date: 'asc',
      }
    });

    return {
      from_date: params.from_date,
      to_date: params.to_date,
      movements: movements.map(m => ({
        product_id: m.product_id,
        product_name: m.product.name,
        warehouse_id: m.warehouse_id,
        transaction_type: m.transaction_type,
        reference_number: m.reference_number,
        movement_date: m.movement_date,
        qty_in: Number(m.qty_in),
        qty_out: Number(m.qty_out),
        running_qty: Number(m.running_qty),
      })),
    };
  }

  async getSalesReport(params: SalesParams): Promise<SalesReport> {
    const posSales = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT 
        SUM(l.line_total) as revenue,
        SUM(l.qty * COALESCE(p.standard_cost, 0)) as cogs
      FROM pos_transaction_lines l
      JOIN pos_transactions t ON l.transaction_id = t.id
      JOIN products p ON l.product_id = p.id
      WHERE t.status = 'COMPLETED' 
        AND t.transaction_date >= $1 AND t.transaction_date <= $2
        ${params.branch_id ? `AND t.shift_id IN (SELECT id FROM shifts WHERE branch_id = '${params.branch_id}')` : ''}
    `, params.from_date, params.to_date);

    const invoiceSales = await this.prisma.$queryRawUnsafe<any[]>(`
      SELECT 
        SUM(l.line_total) as revenue,
        SUM(l.qty * COALESCE(p.standard_cost, 0)) as cogs
      FROM invoice_lines l
      JOIN invoices i ON l.invoice_id = i.id
      LEFT JOIN products p ON l.product_id = p.id
      WHERE i.invoice_type = 'SALES' AND i.status IN ('POSTED', 'PAID')
        AND i.invoice_date >= $1 AND i.invoice_date <= $2
        ${params.branch_id ? `AND i.branch_id = '${params.branch_id}'` : ''}
    `, params.from_date, params.to_date);

    const total_revenue = Number(posSales[0]?.revenue || 0) + Number(invoiceSales[0]?.revenue || 0);
    const total_cogs = Number(posSales[0]?.cogs || 0) + Number(invoiceSales[0]?.cogs || 0);

    return {
      from_date: params.from_date,
      to_date: params.to_date,
      total_revenue,
      total_cogs,
      gross_margin: total_revenue - total_cogs,
      items: [],
    };
  }

  async getSalesTrend(days: number, branchId?: string): Promise<any> {
    const trendResult = await this.prisma.$queryRawUnsafe<any[]>(`
      WITH RECURSIVE dates AS (
        SELECT current_date - interval '1 day' * ($1 - 1) AS d
        UNION ALL
        SELECT d + interval '1 day' FROM dates WHERE d < current_date
      )
      SELECT 
        to_char(d, 'Dy') as date_label,
        COALESCE(SUM(l.line_total), 0) as revenue
      FROM dates
      LEFT JOIN pos_transactions t ON date(t.transaction_date) = date(d) AND t.status = 'COMPLETED'
        ${branchId ? `AND t.shift_id IN (SELECT id FROM shifts WHERE branch_id = '${branchId}')` : ''}
      LEFT JOIN pos_transaction_lines l ON l.transaction_id = t.id
      GROUP BY d
      ORDER BY d ASC
    `, days);
    
    return trendResult.map(r => ({
      date: r.date_label,
      revenue: Number(r.revenue)
    }));
  }

  async getShiftReport(shiftId: UUID): Promise<ShiftReport> {
    const shift = await this.prisma.shift.findUnique({
      where: { id: shiftId },
      include: {
        pos_transactions: {
          where: { status: 'COMPLETED' },
        }
      }
    });

    if (!shift) {
      throw new NotFoundException('Shift not found');
    }

    const totalSales = shift.pos_transactions.reduce((sum, t) => sum + Number(t.paid_amount), 0);

    return {
      shift_id: shift.id,
      cashier_id: shift.cashier_id,
      opening_balance: Number(shift.opening_balance),
      closing_balance: Number(shift.closing_balance || 0),
      total_transactions: shift.pos_transactions.length,
      total_sales: totalSales,
      cash_sales: totalSales, // simplification
      card_sales: 0,
      transfer_sales: 0,
      cash_difference: Number(shift.difference || 0),
      opened_at: shift.opened_at,
      closed_at: shift.closed_at || new Date(),
    };
  }

  async getRecentActivities(limit: number = 10): Promise<RecentActivityItem[]> {
    const logs = await this.prisma.auditLog.findMany({
      orderBy: { created_at: 'desc' },
      take: limit,
      include: { user: true }
    });

    return logs.map(log => {
      let icon = 'InfoOutlined';
      let color = '#4F46E5'; // Default indigo
      let text = `${log.action} on ${log.entity_type}`;

      if (log.action === 'CREATE' && log.entity_type === 'PosTransaction') {
        icon = 'ShoppingCartOutlined';
        text = `New POS Sale`;
      } else if (log.action === 'CREATE' && log.entity_type === 'StockOpname') {
        icon = 'WarningOutlined';
        color = '#F59E0B'; // Amber
        text = `Stock Opname initiated`;
      } else if (log.action === 'UPDATE' && log.entity_type === 'PurchaseOrder') {
        icon = 'CheckCircleOutlined';
        text = `PO updated`;
      } else if (log.action === 'CREATE' && log.entity_type === 'Payment') {
        icon = 'DollarOutlined';
        color = '#10B981'; // Emerald
        text = `Payment processed`;
      }

      return {
        id: log.id,
        text,
        time: log.created_at.toISOString(),
        color,
        icon,
        created_at: log.created_at
      };
    });
  }
}
