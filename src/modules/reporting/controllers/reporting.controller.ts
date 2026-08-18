import {
  Controller,
  Get,
  Query,
  UseGuards,
  Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { ReportingService } from '../services/reporting.service';
import { successResponse } from '../../../common/types/api-response.type';
import { UUID } from '../../../common/types/uuid.type';

@ApiTags('Reporting')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('api/v1/reporting')
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  @ApiOperation({ summary: 'Get Executive Dashboard' })
  @ApiQuery({ name: 'as_of_date', required: false, description: 'As of date' })
  @ApiQuery({ name: 'branch_id', required: false, description: 'Branch ID' })
  @Get('executive-dashboard')
  @RequirePermissions('REPORT.EXECUTIVE')
  async getExecutiveDashboard(
    @Query('as_of_date') asOfDate?: string,
    @Query('branch_id') branchId?: string,
  ) {
    const data = await this.reportingService.getExecutiveDashboard({
      as_of_date: asOfDate ? new Date(asOfDate) : undefined,
      branch_id: branchId as UUID,
    });
    return successResponse(data);
  }

  @ApiOperation({ summary: 'Get Trial Balance' })
  @ApiQuery({ name: 'period_id', required: true, description: 'Period ID' })
  @Get('financial/trial-balance')
  @RequirePermissions('REPORT.FINANCIAL')
  async getTrialBalance(@Query('period_id') periodId: string) {
    const data = await this.reportingService.getTrialBalance({ period_id: periodId as UUID });
    return successResponse(data);
  }

  @ApiOperation({ summary: 'Get Income Statement' })
  @ApiQuery({ name: 'period_id', required: true, description: 'Period ID' })
  @Get('financial/income-statement')
  @RequirePermissions('REPORT.FINANCIAL')
  async getIncomeStatement(@Query('period_id') periodId: string) {
    const data = await this.reportingService.getIncomeStatement({ period_id: periodId as UUID });
    return successResponse(data);
  }

  @ApiOperation({ summary: 'Get Balance Sheet' })
  @ApiQuery({ name: 'as_of_date', required: true, description: 'As of date' })
  @Get('financial/balance-sheet')
  @RequirePermissions('REPORT.FINANCIAL')
  async getBalanceSheet(@Query('as_of_date') asOfDate: string) {
    const data = await this.reportingService.getBalanceSheet({ as_of_date: new Date(asOfDate) });
    return successResponse(data);
  }

  @ApiOperation({ summary: 'Get Cash Flow' })
  @ApiQuery({ name: 'period_id', required: true, description: 'Period ID' })
  @Get('financial/cash-flow')
  @RequirePermissions('REPORT.FINANCIAL')
  async getCashFlow(@Query('period_id') periodId: string) {
    const data = await this.reportingService.getCashFlow({ period_id: periodId as UUID });
    return successResponse(data);
  }

  @ApiOperation({ summary: 'Get AR Aging Report' })
  @ApiQuery({ name: 'as_of_date', required: true, description: 'As of date' })
  @Get('aging/ar')
  @RequirePermissions('REPORT.FINANCIAL')
  async getARAgingReport(@Query('as_of_date') asOfDate: string) {
    const data = await this.reportingService.getARAgingReport({ as_of_date: new Date(asOfDate) });
    return successResponse(data);
  }

  @ApiOperation({ summary: 'Get AP Aging Report' })
  @ApiQuery({ name: 'as_of_date', required: true, description: 'As of date' })
  @Get('aging/ap')
  @RequirePermissions('REPORT.FINANCIAL')
  async getAPAgingReport(@Query('as_of_date') asOfDate: string) {
    const data = await this.reportingService.getAPAgingReport({ as_of_date: new Date(asOfDate) });
    return successResponse(data);
  }

  @ApiOperation({ summary: 'Get Stock Position Report' })
  @ApiQuery({ name: 'as_of_date', required: false, description: 'As of date' })
  @ApiQuery({ name: 'warehouse_id', required: false, description: 'Warehouse ID' })
  @Get('inventory/position')
  @RequirePermissions('REPORT.FINANCIAL')
  async getStockPositionReport(
    @Query('as_of_date') asOfDate?: string,
    @Query('warehouse_id') warehouseId?: string,
  ) {
    const data = await this.reportingService.getStockPositionReport({
      as_of_date: asOfDate ? new Date(asOfDate) : undefined,
      warehouse_id: warehouseId as UUID,
    });
    return successResponse(data);
  }

  @ApiOperation({ summary: 'Get Stock Movement Report' })
  @ApiQuery({ name: 'product_id', required: true, description: 'Product ID' })
  @ApiQuery({ name: 'warehouse_id', required: true, description: 'Warehouse ID' })
  @ApiQuery({ name: 'from_date', required: true, description: 'From date' })
  @ApiQuery({ name: 'to_date', required: true, description: 'To date' })
  @Get('inventory/movement')
  @RequirePermissions('REPORT.FINANCIAL')
  async getStockMovementReport(
    @Query('product_id') productId: string,
    @Query('warehouse_id') warehouseId: string,
    @Query('from_date') fromDate: string,
    @Query('to_date') toDate: string,
  ) {
    const data = await this.reportingService.getStockMovementReport({
      product_id: productId as UUID,
      warehouse_id: warehouseId as UUID,
      from_date: new Date(fromDate),
      to_date: new Date(toDate),
    });
    return successResponse(data);
  }

  @ApiOperation({ summary: 'Get Sales Report' })
  @ApiQuery({ name: 'from_date', required: true, description: 'From date' })
  @ApiQuery({ name: 'to_date', required: true, description: 'To date' })
  @Get('sales')
  @RequirePermissions('REPORT.FINANCIAL')
  async getSalesReport(
    @Query('from_date') fromDate: string,
    @Query('to_date') toDate: string,
  ) {
    const data = await this.reportingService.getSalesReport({
      from_date: new Date(fromDate),
      to_date: new Date(toDate),
    });
    return successResponse(data);
  }

  @ApiOperation({ summary: 'Get Sales Trend' })
  @ApiQuery({ name: 'days', required: true, description: 'Number of days' })
  @ApiQuery({ name: 'branch_id', required: false, description: 'Branch ID' })
  @Get('sales/trend')
  @RequirePermissions('REPORT.FINANCIAL')
  async getSalesTrend(
    @Query('days') days: string,
    @Query('branch_id') branchId?: string,
  ) {
    const data = await this.reportingService.getSalesTrend(days ? parseInt(days, 10) : 7, branchId);
    return successResponse(data);
  }

  @ApiOperation({ summary: 'Get Shift Report' })
  @ApiParam({ name: 'id', description: 'Shift ID' })
  @Get('sales/shift/:id')
  @RequirePermissions('REPORT.FINANCIAL')
  async getShiftReport(@Param('id') shiftId: string) {
    const data = await this.reportingService.getShiftReport(shiftId as UUID);
    return successResponse(data);
  }

  @ApiOperation({ summary: 'Get Recent Activities' })
  @ApiQuery({ name: 'limit', required: false, description: 'Limit number of activities' })
  @Get('recent-activities')
  @RequirePermissions('REPORT.EXECUTIVE')
  async getRecentActivities(@Query('limit') limit?: string) {
    const data = await this.reportingService.getRecentActivities(limit ? parseInt(limit, 10) : 10);
    return successResponse(data);
  }
}
