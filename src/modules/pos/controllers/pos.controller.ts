import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { POSService } from '../services/pos.service';
import { successResponse, paginatedResponse } from '../../../common/types/api-response.type';
import { UUID } from '../../../common/types/uuid.type';
import { OpenShiftDTO, CloseShiftDTO, ProcessTransactionDTO, VoidTransactionDTO, SalesReturnDTO } from '../dto/pos.dto';

interface AuthRequest extends Request {
  user: { sub: string; branch_id?: string | null };
}

/**
 * POS Controller
 * Base URL: /api/v1/pos
 *
 * Endpoints:
 *   GET  /api/v1/pos/shifts            - List shifts
 *   POST /api/v1/pos/shifts            - Open shift
 *   GET  /api/v1/pos/shifts/:id        - Get shift detail
 *   POST /api/v1/pos/shifts/:id/close  - Close shift
 *   GET  /api/v1/pos/transactions      - List transactions
 *   POST /api/v1/pos/transactions      - Create transaction (all-in-one: items + payment)
 *   POST /api/v1/pos/transactions/:id/void - Void transaction
 */
import { UseInterceptors } from '@nestjs/common';
import { IdempotencyInterceptor } from '../../../common/interceptors/idempotency.interceptor';
import { UseIdempotency } from '../../../common/decorators/idempotency.decorator';

@ApiTags('POS - Point of Sales')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@UseInterceptors(IdempotencyInterceptor)
@UseIdempotency()
@Controller('api/v1/pos')
export class POSController {
  constructor(private readonly posService: POSService) {}

  @ApiOperation({ summary: 'POS runtime configuration (tax rate, limits)' })
  @Get('config')
  @RequirePermissions('POS.READ')
  getConfig() {
    return successResponse({
      tax_pct: this.posService.getDefaultTaxPct(),
    });
  }

  // ─── SHIFTS ──────────────────────────────────────────────

  @ApiOperation({ summary: 'List shifts' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'per_page', required: false })
  @ApiOperation({ summary: 'List shifts' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'per_page', required: false })
  @Get('shifts')
  @RequirePermissions('POS.READ')
  async listShifts(@Query() query: { status?: string; page?: number; per_page?: number }, @Request() req: AuthRequest) {
    const result = await this.posService.listShifts({
      status: query.status,
      branch_id: req.user.branch_id,
      page: query.page ? Number(query.page) : 1,
      per_page: query.per_page ? Number(query.per_page) : 20,
    });
    return paginatedResponse(result.data, result.meta.total, result.meta.page, result.meta.per_page);
  }

  @ApiOperation({ summary: 'Open shift' })
  @ApiBody({ type: OpenShiftDTO })
  @Post('shifts')
  @RequirePermissions('POS.CREATE')
  async openShift(@Body() body: OpenShiftDTO, @Request() req: AuthRequest) {
    const shift = await this.posService.openShift({
      cashier_id: req.user.sub as UUID,
      opening_balance: body.opening_balance,
      branch_id: body.branch_id as UUID,
      warehouse_id: body.warehouse_id as UUID,
    });
    return successResponse(shift, 'Shift opened successfully');
  }

  @ApiOperation({ summary: 'Get shift detail' })
  @ApiParam({ name: 'id', description: 'Shift ID' })
  @Get('shifts/:id')
  @RequirePermissions('POS.READ')
  async getShift(@Param('id') id: string, @Request() req: AuthRequest) {
    const shift = await this.posService.getShift(id as UUID, req.user);
    return successResponse(shift);
  }

  @ApiOperation({ summary: 'Close shift' })
  @ApiParam({ name: 'id', description: 'Shift ID' })
  @ApiBody({ type: CloseShiftDTO })
  @Post('shifts/:id/close')
  @RequirePermissions('POS.UPDATE')
  async closeShift(@Param('id') id: string, @Body() body: CloseShiftDTO, @Request() req: AuthRequest) {
    const report = await this.posService.closeShift(id as UUID, body.closing_balance, req.user);
    return successResponse(report, 'Shift closed successfully');
  }

  // ─── TRANSACTIONS ────────────────────────────────────────

  @ApiOperation({ summary: 'List transactions' })
  @ApiQuery({ name: 'shift_id', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'per_page', required: false })
  @Get('transactions')
  @RequirePermissions('POS.READ')
  async listTransactions(
    @Query() query: { shift_id?: string; status?: string; page?: number; per_page?: number },
    @Request() req: AuthRequest,
  ) {
    const result = await this.posService.listTransactions({
      shift_id: query.shift_id as UUID,
      status: query.status,
      branch_id: req.user.branch_id,
      page: query.page ? Number(query.page) : 1,
      per_page: query.per_page ? Number(query.per_page) : 20,
    });
    return paginatedResponse(result.data, result.meta.total, result.meta.page, result.meta.per_page);
  }

  @ApiOperation({ summary: 'Create transaction (all-in-one: items + payment)' })
  @ApiBody({ type: ProcessTransactionDTO })
  @Post('transactions')
  @RequirePermissions('POS.CREATE')
  async processTransaction(@Body() body: ProcessTransactionDTO, @Request() req: AuthRequest) {
    const receipt = await this.posService.processFullTransaction({
      shift_id: body.shift_id as UUID,
      cashier_id: req.user.sub as UUID,
      customer_id: body.customer_id as UUID,
      items: body.items,
      payments: body.payments,
    });
    return successResponse(receipt, 'Transaction completed successfully');
  }

  @ApiOperation({ summary: 'Void transaction' })
  @ApiParam({ name: 'id', description: 'Transaction ID' })
  @ApiBody({ type: VoidTransactionDTO })
  @Post('transactions/:id/void')
  @RequirePermissions('POS.DELETE')
  async voidTransaction(@Param('id') id: string, @Body() body: VoidTransactionDTO, @Request() req: AuthRequest) {
    await this.posService.voidTransaction(id as UUID, req.user.sub as UUID, body.reason, body.version);
    return successResponse(null, 'Transaction voided successfully');
  }

  // ─── SALES RETURNS ────────────────────────────────────────

  @ApiOperation({ summary: 'List sales returns' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'per_page', required: false })
  @Get('sales-returns')
  @RequirePermissions('POS.READ')
  async listSalesReturns(@Query() query: { page?: number; per_page?: number }, @Request() req: AuthRequest) {
    const result = await this.posService.listSalesReturns({
      branch_id: req.user.branch_id,
      page: query.page ? Number(query.page) : 1,
      per_page: query.per_page ? Number(query.per_page) : 20,
    });
    return paginatedResponse(result.data, result.meta.total, result.meta.page, result.meta.per_page);
  }

  @ApiOperation({ summary: 'Create sales return' })
  @ApiBody({ type: SalesReturnDTO })
  @Post('sales-returns')
  @RequirePermissions('POS.CREATE')
  async createSalesReturn(@Body() body: SalesReturnDTO, @Request() req: AuthRequest) {
    const salesReturn = await this.posService.createSalesReturn(req.user.sub as UUID, body);
    return successResponse(salesReturn, 'Sales return created successfully');
  }
}
