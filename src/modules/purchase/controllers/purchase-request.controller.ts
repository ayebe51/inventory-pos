import {
  Controller,
  Post,
  Put,
  Get,
  Delete,
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
import { PurchaseRequestService } from '../services/purchase-request.service';
import { APIResponse, successResponse, paginatedResponse } from '../../../common/types/api-response.type';
import { UUID } from '../../../common/types/uuid.type';
import { PurchaseRequestWithLines } from '../interfaces/purchase.interfaces';
import {
  CreatePurchaseRequestDTO,
  UpdatePurchaseRequestDTO,
  SearchPurchaseRequestDTO,
} from '../dto/purchase-request.dto';

interface AuthRequest extends Request {
  user: { sub: string };
}

/**
 * Purchase Request Controller
 * Handles HTTP endpoints for purchase request management.
 *
 * Base URL: /api/v1/purchase-requests
 */
@Controller('api/v1/purchase-requests')
@UseGuards(JwtAuthGuard, RbacGuard)
export class PurchaseRequestController {
  constructor(private readonly prService: PurchaseRequestService) {}

  /**
   * Create a new Purchase Request.
   * POST /api/v1/purchase-requests
   *
   * Permission: PURCHASE.CREATE
   */
  @Post()
  @RequirePermissions('PURCHASE.CREATE')
  async create(
    @Body() data: CreatePurchaseRequestDTO,
    @Request() req: AuthRequest,
  ): Promise<APIResponse<PurchaseRequestWithLines>> {
    const userId = req.user.sub as UUID;
    const pr = await this.prService.create(data, userId);

    return successResponse(pr, 'Purchase Request created successfully');
  }

  /**
   * Get all Purchase Requests with filters and pagination.
   * GET /api/v1/purchase-requests
   *
   * Permission: PURCHASE.READ
   */
  @Get()
  @RequirePermissions('PURCHASE.READ')
  async search(@Query() query: SearchPurchaseRequestDTO) {
    const filters: any = {
      pr_number: query.pr_number,
      branch_id: query.branch_id,
      warehouse_id: query.warehouse_id,
      status: query.status,
      requested_by: query.requested_by,
      date_from: query.date_from,
      date_to: query.date_to,
      page: query.page || 1,
      per_page: query.per_page || 20,
    };

    const result = await this.prService.search(filters);
    return paginatedResponse(
      result.data,
      result.meta.total,
      result.meta.page,
      result.meta.per_page,
    );
  }

  /**
   * Get a Purchase Request by ID.
   * GET /api/v1/purchase-requests/:id
   *
   * Permission: PURCHASE.READ
   */
  @Get(':id')
  @RequirePermissions('PURCHASE.READ')
  async findById(@Param('id') id: UUID): Promise<APIResponse<PurchaseRequestWithLines>> {
    const pr = await this.prService.findById(id);

    if (!pr) {
      return {
        success: false,
        data: null,
        message: 'Purchase Request not found',
      };
    }

    return successResponse(pr, 'Purchase Request retrieved successfully');
  }

  /**
   * Update a Purchase Request (only in DRAFT status).
   * PUT /api/v1/purchase-requests/:id
   *
   * Permission: PURCHASE.UPDATE
   */
  @Put(':id')
  @RequirePermissions('PURCHASE.UPDATE')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') id: UUID,
    @Body() data: UpdatePurchaseRequestDTO,
    @Request() req: AuthRequest,
  ): Promise<APIResponse<PurchaseRequestWithLines>> {
    const userId = req.user.sub as UUID;
    const pr = await this.prService.update(id, data, userId);

    return successResponse(pr, 'Purchase Request updated successfully');
  }

  /**
   * Submit Purchase Request for approval (DRAFT → SUBMITTED).
   * PUT /api/v1/purchase-requests/:id/submit
   *
   * Permission: PURCHASE.CREATE
   */
  @Put(':id/submit')
  @RequirePermissions('PURCHASE.CREATE')
  @HttpCode(HttpStatus.OK)
  async submit(
    @Param('id') id: UUID,
    @Request() req: AuthRequest,
  ): Promise<APIResponse<PurchaseRequestWithLines>> {
    const userId = req.user.sub as UUID;
    const pr = await this.prService.submit(id, userId);

    return successResponse(pr, 'Purchase Request submitted for approval');
  }

  /**
   * Approve Purchase Request (SUBMITTED → APPROVED).
   * PUT /api/v1/purchase-requests/:id/approve
   *
   * Permission: PURCHASE.APPROVE
   */
  @Put(':id/approve')
  @RequirePermissions('PURCHASE.APPROVE')
  @HttpCode(HttpStatus.OK)
  async approve(
    @Param('id') id: UUID,
    @Body() body: { notes?: string },
    @Request() req: AuthRequest,
  ): Promise<APIResponse<PurchaseRequestWithLines>> {
    const approverId = req.user.sub as UUID;
    const pr = await this.prService.approve(id, approverId, body.notes);

    return successResponse(pr, 'Purchase Request approved successfully');
  }

  /**
   * Reject Purchase Request (SUBMITTED → REJECTED).
   * PUT /api/v1/purchase-requests/:id/reject
   *
   * Permission: PURCHASE.APPROVE
   */
  @Put(':id/reject')
  @RequirePermissions('PURCHASE.APPROVE')
  @HttpCode(HttpStatus.OK)
  async reject(
    @Param('id') id: UUID,
    @Body() body: { reason: string },
    @Request() req: AuthRequest,
  ): Promise<APIResponse<PurchaseRequestWithLines>> {
    const approverId = req.user.sub as UUID;
    const pr = await this.prService.reject(id, approverId, body.reason);

    return successResponse(pr, 'Purchase Request rejected');
  }

  /**
   * Cancel Purchase Request (DRAFT/SUBMITTED → CANCELLED).
   * PUT /api/v1/purchase-requests/:id/cancel
   *
   * Permission: PURCHASE.DELETE
   */
  @Put(':id/cancel')
  @RequirePermissions('PURCHASE.DELETE')
  @HttpCode(HttpStatus.OK)
  async cancel(
    @Param('id') id: UUID,
    @Body() body: { reason: string },
    @Request() req: AuthRequest,
  ): Promise<APIResponse<PurchaseRequestWithLines>> {
    const userId = req.user.sub as UUID;
    const pr = await this.prService.cancel(id, userId, body.reason);

    return successResponse(pr, 'Purchase Request cancelled');
  }

  /**
   * Soft-delete a Purchase Request.
   * DELETE /api/v1/purchase-requests/:id
   *
   * Permission: PURCHASE.DELETE
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('PURCHASE.DELETE')
  async delete(
    @Param('id') id: UUID,
    @Request() req: AuthRequest,
  ): Promise<APIResponse<null>> {
    const userId = req.user.sub as UUID;
    await this.prService.delete(id, userId);

    return successResponse(null, 'Purchase Request deleted successfully');
  }
}
