import {
  Body,
  Controller,
  Get,
  Post,
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
import { StockTransferDTO } from '../dto/inventory.dto';

interface AuthRequest extends Request {
  user: { sub: string };
}

@ApiTags('Inventory - Stock Transfers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('api/v1/inventory/stock-transfers')
export class StockTransferController {
  constructor(private readonly inventoryService: InventoryService) {}

  /**
   * GET /api/v1/inventory/stock-transfers
   * List all stock transfers
   */
  @ApiOperation({ summary: 'List all stock transfers' })
  @ApiQuery({ name: 'from_warehouse_id', required: false })
  @ApiQuery({ name: 'to_warehouse_id', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'per_page', required: false })
  @Get()
  @RequirePermissions('STOCK.TRANSFER')
  async listTransfers(
    @Query('from_warehouse_id') fromWarehouseId?: string,
    @Query('to_warehouse_id') toWarehouseId?: string,
    @Query('page') page?: string,
    @Query('per_page') perPage?: string,
  ) {
    const result = await this.inventoryService.listStockTransfers({
      from_warehouse_id: fromWarehouseId as UUID,
      to_warehouse_id: toWarehouseId as UUID,
      page: page ? parseInt(page, 10) : 1,
      per_page: perPage ? parseInt(perPage, 10) : 20,
    });
    return successResponse(result.data, 'Stock transfers retrieved successfully', result.meta);
  }

  /**
   * POST /api/v1/inventory/stock-transfers
   * Create a new stock transfer
   */
  @ApiOperation({ summary: 'Create a new stock transfer' })
  @ApiBody({ type: StockTransferDTO })
  @Post()
  @RequirePermissions('STOCK.TRANSFER')
  async transferStock(
    @Body() body: StockTransferDTO,
    @Request() req: AuthRequest,
  ) {
    const transfer = await this.inventoryService.transferStock({
      from_warehouse_id: body.from_warehouse_id as UUID,
      to_warehouse_id: body.to_warehouse_id as UUID,
      transfer_date: new Date(body.transfer_date),
      created_by: req.user.sub as UUID,
      lines: body.lines.map((l) => ({ ...l, product_id: l.product_id as UUID, uom_id: l.uom_id as UUID })),
    });
    return successResponse(transfer, 'Stock transfer completed successfully');
  }
}
