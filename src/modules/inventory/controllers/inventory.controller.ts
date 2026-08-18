import {
  Body,
  Controller,
  Post,
  Get,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { InventoryService } from '../services/inventory.service';
import { successResponse } from '../../../common/types/api-response.type';
import { UUID } from '../../../common/types/uuid.type';
import { StockAdjustmentDTO, StockTransferDTO } from '../dto/inventory.dto';

interface AuthRequest extends Request {
  user: { sub: string };
}

@ApiTags('Inventory')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('api/v1/inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  /**
   * POST /api/v1/inventory/transfer
   * Transfer stock between warehouses
   */
  @ApiOperation({ summary: 'Transfer stock between warehouses' })
  @ApiBody({ type: StockTransferDTO })
  @Post('transfer')
  @RequirePermissions('INVENTORY.UPDATE') // Or a specific TRANSFER permission
  async transferStock(@Body() body: StockTransferDTO, @Request() req: AuthRequest) {
    body.created_by = req.user.sub as UUID;
    const transfer = await this.inventoryService.transferStock(body as any);
    return successResponse(transfer, 'Stock transfer completed successfully');
  }

  /**
   * POST /api/v1/inventory/adjust
   * Adjust stock manually
   */
  @ApiOperation({ summary: 'Adjust stock manually' })
  @ApiBody({ type: StockAdjustmentDTO })
  @Post('adjust')
  @RequirePermissions('STOCK.ADJUST')
  async adjustStock(@Body() body: StockAdjustmentDTO, @Request() req: AuthRequest) {
    const adjustment = await this.inventoryService.adjustStock(body as any, req.user.sub as UUID);
    return successResponse(adjustment, 'Stock adjusted successfully');
  }

  /**
   * GET /api/v1/inventory/ledger
   * Get stock ledger
   */
  @ApiOperation({ summary: 'Get stock ledger' })
  @ApiQuery({ name: 'product_id', required: false, description: 'Product ID' })
  @ApiQuery({ name: 'warehouse_id', required: false, description: 'Warehouse ID' })
  @ApiQuery({ name: 'limit', required: false, description: 'Limit' })
  @Get('ledger')
  @RequirePermissions('INVENTORY.READ')
  async getLedger(
    @Query('product_id') productId?: string,
    @Query('warehouse_id') warehouseId?: string,
    @Query('limit') limit?: string,
  ) {
    const filters = {
      product_id: productId as UUID | undefined,
      warehouse_id: warehouseId as UUID | undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    };
    const ledger = await this.inventoryService.getLedger(filters);
    return successResponse(ledger);
  }
}
