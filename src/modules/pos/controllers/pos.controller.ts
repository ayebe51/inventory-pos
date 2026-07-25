import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { POSService } from '../services/pos.service';
import { successResponse, paginatedResponse } from '../../../common/types/api-response.type';
import { UUID } from '../../../common/types/uuid.type';

interface AuthRequest extends Request {
  user: { sub: string };
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
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('api/v1/pos')
export class POSController {
  constructor(private readonly posService: POSService) {}

  // ─── SHIFTS ──────────────────────────────────────────────

  @Get('shifts')
  @RequirePermissions('POS.READ')
  async listShifts(@Query() query: { status?: string; page?: number; per_page?: number }) {
    const result = await this.posService.listShifts({
      status: query.status,
      page: query.page || 1,
      per_page: query.per_page || 20,
    });
    return paginatedResponse(result.data, result.meta.total, result.meta.page, result.meta.per_page);
  }

  @Post('shifts')
  @RequirePermissions('POS.CREATE')
  async openShift(@Body() body: { opening_balance: number }, @Request() req: AuthRequest) {
    const shift = await this.posService.openShift({
      cashier_id: req.user.sub as UUID,
      opening_balance: body.opening_balance,
    });
    return successResponse(shift, 'Shift opened successfully');
  }

  @Get('shifts/:id')
  @RequirePermissions('POS.READ')
  async getShift(@Param('id') id: string) {
    const shift = await this.posService.getShift(id as UUID);
    return successResponse(shift, 'Shift retrieved');
  }

  @Post('shifts/:id/close')
  @RequirePermissions('POS.CREATE')
  @HttpCode(HttpStatus.OK)
  async closeShift(@Param('id') id: string, @Body() body: { closing_balance: number }) {
    const report = await this.posService.closeShift(id as UUID, body.closing_balance);
    return successResponse(report, 'Shift closed successfully');
  }

  // ─── TRANSACTIONS ─────────────────────────────────────────

  @Get('transactions')
  @RequirePermissions('POS.READ')
  async listTransactions(@Query() query: { shift_id?: string; status?: string; page?: number }) {
    const result = await this.posService.listTransactions({
      shift_id: query.shift_id as UUID,
      status: query.status,
      page: query.page || 1,
      per_page: 20,
    });
    return paginatedResponse(result.data, result.meta.total, result.meta.page, result.meta.per_page);
  }

  @Post('transactions')
  @RequirePermissions('POS.CREATE')
  async createTransaction(
    @Body() body: {
      shift_id: string;
      customer_id?: string;
      items: { product_id: string; quantity: number; unit_price: number; discount_pct?: number }[];
      payments: { method: string; amount: number; reference?: string }[];
    },
    @Request() req: AuthRequest,
  ) {
    // All-in-one: create transaction, add items, process payment
    const receipt = await this.posService.processFullTransaction({
      shift_id: body.shift_id as UUID,
      cashier_id: req.user.sub as UUID,
      customer_id: body.customer_id as UUID | undefined,
      items: body.items,
      payments: body.payments,
    });
    return successResponse(receipt, 'Transaction completed successfully');
  }

  @Post('transactions/:id/void')
  @RequirePermissions('POS.VOID')
  @HttpCode(HttpStatus.OK)
  async voidTransaction(
    @Param('id') transactionId: string,
    @Body() body: { reason: string; version?: number },
    @Request() req: AuthRequest,
  ) {
    await this.posService.voidTransaction(
      transactionId as UUID,
      req.user.sub as UUID,
      body.reason,
      body.version || 1,
    );
    return successResponse(null, 'Transaction voided');
  }
}
