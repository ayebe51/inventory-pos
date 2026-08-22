import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { PurchaseReturnService, CreatePurchaseReturnDTO } from '../services/purchase-return.service';
import { successResponse } from '../../../common/types/api-response.type';
import { UUID } from '../../../common/types/uuid.type';

interface AuthRequest extends Request {
  user: { sub: string };
}

@ApiTags('Purchase - Purchase Returns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('api/v1/purchase-returns')
export class PurchaseReturnController {
  constructor(private readonly purchaseReturnService: PurchaseReturnService) {}

  @ApiOperation({ summary: 'Create and execute a Purchase Return' })
  @Post()
  @RequirePermissions('PURCHASE.CREATE')
  async create(@Body() body: CreatePurchaseReturnDTO, @Request() req: AuthRequest) {
    const data = await this.purchaseReturnService.createReturn(body, req.user.sub as UUID);
    return successResponse(data, 'Purchase return created and stock updated successfully');
  }

  @ApiOperation({ summary: 'List all Purchase Returns' })
  @ApiQuery({ name: 'supplier_id', required: false })
  @ApiQuery({ name: 'warehouse_id', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'per_page', required: false })
  @Get()
  @RequirePermissions('PURCHASE.READ')
  async list(
    @Query('supplier_id') supplierId?: string,
    @Query('warehouse_id') warehouseId?: string,
    @Query('page') page?: string,
    @Query('per_page') perPage?: string,
  ) {
    const result = await this.purchaseReturnService.listReturns({
      supplier_id: supplierId as UUID,
      warehouse_id: warehouseId as UUID,
      page: page ? parseInt(page, 10) : 1,
      per_page: perPage ? parseInt(perPage, 10) : 20,
    });
    return successResponse(result.data, 'Purchase returns retrieved successfully', result.meta);
  }

  @ApiOperation({ summary: 'Get Purchase Return by ID' })
  @ApiParam({ name: 'id', description: 'Purchase Return ID' })
  @Get(':id')
  @RequirePermissions('PURCHASE.READ')
  async findById(@Param('id') id: string) {
    const data = await this.purchaseReturnService.getReturnById(id as UUID);
    return successResponse(data);
  }
}
