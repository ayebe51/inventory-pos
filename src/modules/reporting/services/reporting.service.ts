import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma.service';
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
} from '../interfaces/reporting.interfaces';
import { UUID } from '../../../common/types/uuid.type';

@Injectable()
export class ReportingService implements IReportingService {
  constructor(private readonly prisma: PrismaService) {}

  async getExecutiveDashboard(params: DashboardParams): Promise<ExecutiveDashboard> {
    const asOfDate = params.as_of_date || new Date();
    const branchFilter = params.branch_id ? `AND branch_id = '${params.branch_id}'` : '';
    
    // Simulate complex dashboard aggregation
    // For production, these would be robust raw queries against a read replica
    return {
      total_sales: 150000000,
      total_purchases: 85000000,
      cash_position: 250000000,
      ar_outstanding: 45000000,
      ap_outstanding: 30000000,
      top_products: [],
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
    // Stub for Income Statement
    return {
      period_id: params.period_id,
      revenue: 0,
      cogs: 0,
      gross_profit: 0,
      operating_expenses: 0,
      net_income: 0,
    };
  }

  async getBalanceSheet(params: AsOfDateParams): Promise<BalanceSheet> {
    // Stub for Balance Sheet
    return {
      as_of_date: params.as_of_date,
      total_assets: 0,
      total_liabilities: 0,
      total_equity: 0,
    };
  }

  async getCashFlow(params: PeriodParams): Promise<CashFlowStatement> {
    // Stub for Cash Flow
    return {
      period_id: params.period_id,
      operating_activities: 0,
      investing_activities: 0,
      financing_activities: 0,
      net_cash_flow: 0,
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
    // Stub
    return {
      from_date: params.from_date,
      to_date: params.to_date,
      total_revenue: 0,
      total_cogs: 0,
      gross_margin: 0,
      items: [],
    };
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
}
