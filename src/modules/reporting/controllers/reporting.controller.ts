import {
  Controller,
  Get,
  Query,
  UseGuards,
  Param,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { ReportingService } from '../services/reporting.service';
import { successResponse } from '../../../common/types/api-response.type';
import { UUID } from '../../../common/types/uuid.type';

@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('api/v1/reporting')
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  @Get('executive-dashboard')
  @RequirePermissions('REPORT.VIEW')
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

  @Get('financial/trial-balance')
  @RequirePermissions('REPORT.VIEW')
  async getTrialBalance(@Query('period_id') periodId: string) {
    const data = await this.reportingService.getTrialBalance({ period_id: periodId as UUID });
    return successResponse(data);
  }

  @Get('financial/income-statement')
  @RequirePermissions('REPORT.VIEW')
  async getIncomeStatement(@Query('period_id') periodId: string) {
    const data = await this.reportingService.getIncomeStatement({ period_id: periodId as UUID });
    return successResponse(data);
  }

  @Get('financial/balance-sheet')
  @RequirePermissions('REPORT.VIEW')
  async getBalanceSheet(@Query('as_of_date') asOfDate: string) {
    const data = await this.reportingService.getBalanceSheet({ as_of_date: new Date(asOfDate) });
    return successResponse(data);
  }

  @Get('financial/cash-flow')
  @RequirePermissions('REPORT.VIEW')
  async getCashFlow(@Query('period_id') periodId: string) {
    const data = await this.reportingService.getCashFlow({ period_id: periodId as UUID });
    return successResponse(data);
  }

  @Get('aging/ar')
  @RequirePermissions('REPORT.VIEW')
  async getARAgingReport(@Query('as_of_date') asOfDate: string) {
    const data = await this.reportingService.getARAgingReport({ as_of_date: new Date(asOfDate) });
    return successResponse(data);
  }

  @Get('aging/ap')
  @RequirePermissions('REPORT.VIEW')
  async getAPAgingReport(@Query('as_of_date') asOfDate: string) {
    const data = await this.reportingService.getAPAgingReport({ as_of_date: new Date(asOfDate) });
    return successResponse(data);
  }

  @Get('inventory/position')
  @RequirePermissions('REPORT.VIEW')
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

  @Get('inventory/movement')
  @RequirePermissions('REPORT.VIEW')
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

  @Get('sales')
  @RequirePermissions('REPORT.VIEW')
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

  @Get('sales/shift/:id')
  @RequirePermissions('REPORT.VIEW')
  async getShiftReport(@Param('id') shiftId: string) {
    const data = await this.reportingService.getShiftReport(shiftId as UUID);
    return successResponse(data);
  }
}
