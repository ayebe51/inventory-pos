import {
  Controller,
  Post,
  Put,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { GoodsReceiptService } from '../services/goods-receipt.service';
import { APIResponse, successResponse, paginatedResponse } from '../../../common/types/api-response.type';
import { UUID } from '../../../common/types/uuid.type';
import { GoodsReceipt } from '../interfaces/purchase.interfaces';
import {
  CreateGoodsReceiptDTO,
  ConfirmGoodsReceiptDTO,
  SearchGoodsReceiptDTO,
} from '../dto/goods-receipt.dto';

interface AuthRequest extends Request {
  user: { sub: string };
}

/**
 * Goods Receipt Controller
 * Handles HTTP endpoints for goods receipt management.
 *
 * Base URL: /api/v1/goods-receipts
 */
@Controller('api/v1/goods-receipts')
@UseGuards(JwtAuthGuard, RbacGuard)
export class GoodsReceiptController {
  constructor(private readonly grService: GoodsReceiptService) {}

  /**
   * Create a new Goods Receipt from a Purchase Order.
   * POST /api/v1/goods-receipts
   *
   * Permission: INVENTORY.CREATE
   */
  @Post()
  @RequirePermissions('INVENTORY.CREATE')
  async create(
    @Body() data: CreateGoodsReceiptDTO,
    @Request() req: AuthRequest,
  ): Promise<APIResponse<GoodsReceipt>> {
    const userId = req.user.sub as UUID;
    
    // Convert string date to Date if needed
    const grData = {
      ...data,
      receipt_date: typeof data.receipt_date === 'string' 
        ? new Date(data.receipt_date) 
        : data.receipt_date,
    };
    
    const gr = await this.grService.create(grData.po_id, grData as any, userId);

    return successResponse(gr, 'Goods Receipt created successfully');
  }

  /**
   * Get all Goods Receipts with filters and pagination.
   * GET /api/v1/goods-receipts
   *
   * Permission: INVENTORY.READ
   */
  @Get()
  @RequirePermissions('INVENTORY.READ')
  async search(@Query() query: SearchGoodsReceiptDTO) {
    const filters = {
      gr_number: query.gr_number,
      po_id: query.po_id,
      supplier_id: query.supplier_id,
      warehouse_id: query.warehouse_id,
      status: query.status,
      date_from: query.date_from,
      date_to: query.date_to,
      page: query.page || 1,
      per_page: query.per_page || 20,
    };

    const result = await this.grService.search(filters);
    return paginatedResponse(
      result.data,
      result.meta.total,
      result.meta.page,
      result.meta.per_page,
    );
  }

  /**
   * Get a Goods Receipt by ID.
   * GET /api/v1/goods-receipts/:id
   *
   * Permission: INVENTORY.READ
   */
  @Get(':id')
  @RequirePermissions('INVENTORY.READ')
  async findById(@Param('id') id: UUID): Promise<APIResponse<GoodsReceipt>> {
    const gr = await this.grService.findById(id);

    if (!gr) {
      return {
        success: false,
        data: null,
        message: 'Goods Receipt not found',
      };
    }

    return successResponse(gr, 'Goods Receipt retrieved successfully');
  }

  /**
   * Confirm a Goods Receipt (DRAFT → CONFIRMED).
   * This triggers:
   * - Update qty_received on PO lines
   * - Update PO status (PARTIALLY_RECEIVED or FULLY_RECEIVED)
   * - Recalculate Weighted Average Cost
   * - Create auto journal entry (Debit Inventory, Credit GR Clearing)
   * - Record inventory ledger entry
   *
   * PUT /api/v1/goods-receipts/:id/confirm
   *
   * Permission: INVENTORY.UPDATE
   */
  @Put(':id/confirm')
  @RequirePermissions('INVENTORY.UPDATE')
  @HttpCode(HttpStatus.OK)
  async confirm(
    @Param('id') id: UUID,
    @Body() _body: ConfirmGoodsReceiptDTO,
    @Request() req: AuthRequest,
  ): Promise<APIResponse<GoodsReceipt>> {
    const userId = req.user.sub as UUID;
    const gr = await this.grService.confirm(id, userId);

    return successResponse(gr, 'Goods Receipt confirmed successfully');
  }

  /**
   * Get Goods Receipts by Purchase Order ID.
   * GET /api/v1/goods-receipts/by-po/:poId
   *
   * Permission: INVENTORY.READ
   */
  @Get('by-po/:poId')
  @RequirePermissions('INVENTORY.READ')
  async findByPurchaseOrder(@Param('poId') poId: UUID): Promise<APIResponse<GoodsReceipt[]>> {
    const receipts = await this.grService.findByPurchaseOrder(poId);

    return successResponse(receipts, 'Goods Receipts retrieved successfully');
  }

  /**
   * Cancel a Goods Receipt (only in DRAFT status).
   * PUT /api/v1/goods-receipts/:id/cancel
   *
   * Permission: INVENTORY.DELETE
   */
  @Put(':id/cancel')
  @RequirePermissions('INVENTORY.DELETE')
  @HttpCode(HttpStatus.OK)
  async cancel(
    @Param('id') id: UUID,
    @Body() body: { reason: string },
    @Request() req: AuthRequest,
  ): Promise<APIResponse<GoodsReceipt>> {
    const userId = req.user.sub as UUID;
    const gr = await this.grService.cancel(id, userId, body.reason);

    return successResponse(gr, 'Goods Receipt cancelled');
  }
}
