import {
  Body,
  Controller,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { InventoryService } from '../services/inventory.service';
import { successResponse } from '../../../common/types/api-response.type';
import { UUID } from '../../../common/types/uuid.type';
import { StockAdjustmentDTO, StockTransferDTO } from '../interfaces/inventory.interfaces';

interface AuthRequest extends Request {
  user: { sub: string };
}

@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('api/v1/inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  /**
   * POST /api/v1/inventory/transfer
   * Transfer stock between warehouses
   */
  @Post('transfer')
  @RequirePermissions('INVENTORY.UPDATE') // Or a specific TRANSFER permission
  async transferStock(@Body() body: StockTransferDTO, @Request() req: AuthRequest) {
    const transfer = await this.inventoryService.transferStock(body);
    return successResponse(transfer, 'Stock transfer completed successfully');
  }

  /**
   * POST /api/v1/inventory/adjust
   * Adjust stock manually
   */
  @Post('adjust')
  @RequirePermissions('STOCK.ADJUST')
  async adjustStock(@Body() body: StockAdjustmentDTO, @Request() req: AuthRequest) {
    const adjustment = await this.inventoryService.adjustStock(body, req.user.sub as UUID);
    return successResponse(adjustment, 'Stock adjusted successfully');
  }
}
