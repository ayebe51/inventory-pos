import {
  Body,
  Controller,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { StockOpnameService } from '../services/stock-opname.service';
import { successResponse } from '../../../common/types/api-response.type';
import { UUID } from '../../../common/types/uuid.type';

interface AuthRequest extends Request {
  user: { sub: string };
}

@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('api/v1/inventory/stock-opname')
export class StockOpnameController {
  constructor(private readonly opnameService: StockOpnameService) {}

  /**
   * POST /api/v1/inventory/stock-opname/initiate
   * Initiate a new stock opname (locks warehouse)
   */
  @Post('initiate')
  @RequirePermissions('STOCK.OPNAME')
  async initiate(@Body('warehouse_id') warehouseId: string, @Request() req: AuthRequest) {
    const opname = await this.opnameService.initiate(warehouseId as UUID, req.user.sub as UUID);
    return successResponse(opname, 'Stock opname initiated and warehouse locked');
  }

  /**
   * POST /api/v1/inventory/stock-opname/:id/record
   * Record physical counts for an opname
   */
  @Post(':id/record')
  @RequirePermissions('STOCK.OPNAME')
  async recordCount(
    @Param('id') opnameId: string,
    @Body('items') items: { product_id: UUID; qty_counted: number }[],
  ) {
    await this.opnameService.recordCount(opnameId as UUID, items);
    return successResponse(null, 'Counts recorded successfully');
  }

  /**
   * POST /api/v1/inventory/stock-opname/:id/finalize
   * Finalize the opname, create adjustments, and unlock warehouse
   */
  @Post(':id/finalize')
  @RequirePermissions('STOCK.OPNAME')
  async finalize(@Param('id') opnameId: string, @Request() req: AuthRequest) {
    const adjustment = await this.opnameService.finalize(opnameId as UUID, req.user.sub as UUID);
    return successResponse(adjustment, 'Stock opname finalized and warehouse unlocked');
  }
}
