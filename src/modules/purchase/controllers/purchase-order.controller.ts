import {
  Controller,
  Post,
  Put,
  Get,
  Param,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { PurchaseOrderService } from '../services/purchase-order.service';
import { APIResponse } from '../../../common/types/api-response.type';
import { UUID } from '../../../common/types/uuid.type';
import { PurchaseOrder, GoodsReceipt } from '../interfaces/purchase.interfaces';
import { CreatePODTO, GoodsReceiptDTO } from '../dto/purchase-order.dto';

/**
 * Purchase Order Controller
 * Handles HTTP endpoints for purchase order management.
 */
@Controller('api/v1/purchase-orders')
@UseGuards(JwtAuthGuard, RbacGuard)
export class PurchaseOrderController {
  constructor(private readonly poService: PurchaseOrderService) {}

  /**
   * Create a new Purchase Order.
   * POST /api/v1/purchase-orders
   */
  @Post()
  @RequirePermissions('PURCHASE.CREATE')
  async create(
    @Body() data: CreatePODTO,
    @Request() req: any,
  ): Promise<APIResponse<PurchaseOrder>> {
    const userId = req.user.sub as UUID;
    const po = await this.poService.create(data, userId);

    return {
      success: true,
      data: po,
      message: 'Purchase Order created successfully',
    };
  }

  /**
   * Get a Purchase Order by ID.
   * GET /api/v1/purchase-orders/:id
   */
  @Get(':id')
  @RequirePermissions('PURCHASE.READ')
  async findById(@Param('id') id: UUID): Promise<APIResponse<PurchaseOrder>> {
    const po = await this.poService.findById(id);

    if (!po) {
      return {
        success: false,
        data: null,
        message: 'Purchase Order not found',
      };
    }

    return {
      success: true,
      data: po,
      message: 'Purchase Order retrieved successfully',
    };
  }

  /**
   * Submit PO for approval (DRAFT → PENDING_APPROVAL).
   * PUT /api/v1/purchase-orders/:id/submit
   */
  @Put(':id/submit')
  @RequirePermissions('PURCHASE.CREATE')
  @HttpCode(HttpStatus.OK)
  async submit(
    @Param('id') id: UUID,
    @Request() req: any,
  ): Promise<APIResponse<PurchaseOrder>> {
    const userId = req.user.sub as UUID;
    const po = await this.poService.submit(id, userId);

    return {
      success: true,
      data: po,
      message: 'Purchase Order submitted for approval',
    };
  }

  /**
   * Approve PO (PENDING_APPROVAL → APPROVED).
   * Validates RBAC permission (PURCHASE.APPROVE) and SOD-001.
   * PUT /api/v1/purchase-orders/:id/approve
   */
  @Put(':id/approve')
  @RequirePermissions('PURCHASE.APPROVE')
  @HttpCode(HttpStatus.OK)
  async approve(
    @Param('id') id: UUID,
    @Body() body: { notes?: string },
    @Request() req: any,
  ): Promise<APIResponse<PurchaseOrder>> {
    const approverId = req.user.sub as UUID;
    const po = await this.poService.approve(id, approverId, body.notes);

    return {
      success: true,
      data: po,
      message: 'Purchase Order approved successfully',
    };
  }

  /**
   * Reject PO (PENDING_APPROVAL → REJECTED).
   * Validates RBAC permission (PURCHASE.APPROVE).
   * PUT /api/v1/purchase-orders/:id/reject
   */
  @Put(':id/reject')
  @RequirePermissions('PURCHASE.APPROVE')
  @HttpCode(HttpStatus.OK)
  async reject(
    @Param('id') id: UUID,
    @Body() body: { reason: string },
    @Request() req: any,
  ): Promise<APIResponse<PurchaseOrder>> {
    const approverId = req.user.sub as UUID;
    const po = await this.poService.reject(id, approverId, body.reason);

    return {
      success: true,
      data: po,
      message: 'Purchase Order rejected',
    };
  }

  /**
   * Revise rejected PO back to DRAFT (REJECTED → DRAFT).
   * PUT /api/v1/purchase-orders/:id/revise
   */
  @Put(':id/revise')
  @RequirePermissions('PURCHASE.UPDATE')
  @HttpCode(HttpStatus.OK)
  async revise(
    @Param('id') id: UUID,
    @Request() req: any,
  ): Promise<APIResponse<PurchaseOrder>> {
    const userId = req.user.sub as UUID;
    const po = await this.poService.revise(id, userId);

    return {
      success: true,
      data: po,
      message: 'Purchase Order revised to DRAFT',
    };
  }

  /**
   * Cancel PO (APPROVED → CANCELLED).
   * PUT /api/v1/purchase-orders/:id/cancel
   */
  @Put(':id/cancel')
  @RequirePermissions('PURCHASE.DELETE')
  @HttpCode(HttpStatus.OK)
  async cancel(
    @Param('id') id: UUID,
    @Body() body: { reason: string },
    @Request() req: any,
  ): Promise<APIResponse<PurchaseOrder>> {
    const userId = req.user.sub as UUID;
    const po = await this.poService.cancel(id, userId, body.reason);

    return {
      success: true,
      data: po,
      message: 'Purchase Order cancelled',
    };
  }

  /**
   * Close PO (FULLY_RECEIVED → CLOSED).
   * PUT /api/v1/purchase-orders/:id/close
   */
  @Put(':id/close')
  @RequirePermissions('PURCHASE.UPDATE')
  @HttpCode(HttpStatus.OK)
  async close(
    @Param('id') id: UUID,
    @Request() req: any,
  ): Promise<APIResponse<PurchaseOrder>> {
    const userId = req.user.sub as UUID;
    const po = await this.poService.close(id, userId);

    return {
      success: true,
      data: po,
      message: 'Purchase Order closed',
    };
  }

  /**
   * Create Goods Receipt for PO.
   * POST /api/v1/purchase-orders/:id/goods-receipts
   */
  @Post(':id/goods-receipts')
  @RequirePermissions('INVENTORY.CREATE')
  async receiveGoods(
    @Param('id') id: UUID,
    @Body() data: GoodsReceiptDTO,
    @Request() req: any,
  ): Promise<APIResponse<GoodsReceipt>> {
    const userId = req.user.sub as UUID;
    const gr = await this.poService.receiveGoods(id, data, userId);

    return {
      success: true,
      data: gr,
      message: 'Goods Receipt created successfully',
    };
  }
}
