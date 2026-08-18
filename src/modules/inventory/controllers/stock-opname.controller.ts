import {
  Body,
  Controller,
  Param,
  Post,
  Get,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { StockOpnameService } from '../services/stock-opname.service';
import { successResponse } from '../../../common/types/api-response.type';
import { UUID } from '../../../common/types/uuid.type';
import { StockOpnameInitiateDTO, StockOpnameRecordDTO } from '../dto/inventory.dto';

interface AuthRequest extends Request {
  user: { sub: string };
}

@ApiTags('Inventory - Stock Opname')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('api/v1/inventory/stock-opname')
export class StockOpnameController {
  constructor(private readonly opnameService: StockOpnameService) {}

  /**
   * GET /api/v1/inventory/stock-opname
   * List all stock opnames
   */
  @ApiOperation({ summary: 'List all stock opnames' })
  @Get()
  @RequirePermissions('STOCK.OPNAME')
  async findAll() {
    const opnames = await this.opnameService.findAll();
    return successResponse(opnames);
  }

  /**
   * POST /api/v1/inventory/stock-opname/initiate
   * Initiate a new stock opname (locks warehouse)
   */
  @ApiOperation({ summary: 'Initiate a new stock opname (locks warehouse)' })
  @ApiBody({ type: StockOpnameInitiateDTO })
  @Post('initiate')
  @RequirePermissions('STOCK.OPNAME')
  async initiate(@Body() body: StockOpnameInitiateDTO, @Request() req: AuthRequest) {
    const opname = await this.opnameService.initiate(body.warehouse_id as UUID, req.user.sub as UUID);
    return successResponse(opname, 'Stock opname initiated and warehouse locked');
  }

  /**
   * POST /api/v1/inventory/stock-opname/:id/record
   * Record physical counts for an opname
   */
  @ApiOperation({ summary: 'Record physical counts for an opname' })
  @ApiParam({ name: 'id', description: 'Opname ID' })
  @ApiBody({ type: StockOpnameRecordDTO })
  @Post(':id/record')
  @RequirePermissions('STOCK.OPNAME')
  async recordCount(
    @Param('id') opnameId: string,
    @Body() body: StockOpnameRecordDTO,
  ) {
    await this.opnameService.recordCount(opnameId as UUID, body.items);
    return successResponse(null, 'Counts recorded successfully');
  }

  /**
   * POST /api/v1/inventory/stock-opname/:id/finalize
   * Finalize the opname, create adjustments, and unlock warehouse
   */
  @ApiOperation({ summary: 'Finalize the opname, create adjustments, and unlock warehouse' })
  @ApiParam({ name: 'id', description: 'Opname ID' })
  @Post(':id/finalize')
  @RequirePermissions('STOCK.OPNAME')
  async finalize(@Param('id') opnameId: string, @Request() req: AuthRequest) {
    const adjustment = await this.opnameService.finalize(opnameId as UUID, req.user.sub as UUID);
    return successResponse(adjustment, 'Stock opname finalized and warehouse unlocked');
  }
}
