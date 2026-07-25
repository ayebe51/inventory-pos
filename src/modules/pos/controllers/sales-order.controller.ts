import {
  Body,
  Controller,
  Param,
  Post,
  Get,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { SalesOrderService } from '../services/sales-order.service';
import { successResponse } from '../../../common/types/api-response.type';
import { UUID } from '../../../common/types/uuid.type';
import { CreateSODTO, FulfillmentDTO, SalesReturnDTO } from '../interfaces/pos.interfaces';

interface AuthRequest extends Request {
  user: { sub: string };
}

@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('api/v1/sales-orders')
export class SalesOrderController {
  constructor(private readonly salesOrderService: SalesOrderService) {}

  @Post()
  @RequirePermissions('SALES.CREATE')
  async create(@Body() body: CreateSODTO, @Request() req: AuthRequest) {
    const so = await this.salesOrderService.create(body);
    return successResponse(so, 'Sales Order created successfully');
  }

  @Post(':id/approve')
  @RequirePermissions('SALES.APPROVE')
  async approve(@Param('id') id: string, @Request() req: AuthRequest) {
    const so = await this.salesOrderService.approve(id as UUID, req.user.sub as UUID);
    return successResponse(so, 'Sales Order approved successfully');
  }

  @Post(':id/fulfill')
  @RequirePermissions('SALES.FULFILL')
  async fulfill(@Param('id') id: string, @Body() data: FulfillmentDTO) {
    const deliveryOrder = await this.salesOrderService.fulfill(id as UUID, data);
    return successResponse(deliveryOrder, 'Sales Order fulfilled and Delivery Order created');
  }

  @Post(':id/return')
  @RequirePermissions('SALES.RETURN')
  async createReturn(@Param('id') id: string, @Body() data: SalesReturnDTO) {
    const sr = await this.salesOrderService.createReturn(id as UUID, data);
    return successResponse(sr, 'Sales Return created successfully');
  }

  @Get()
  @RequirePermissions('SALES.READ')
  async search(@Request() req: Request) {
    const query = (req as any).query;
    const filters = {
      status: query.status,
      customer_id: query.customer_id,
      page: query.page ? parseInt(query.page) : 1,
      per_page: query.per_page ? parseInt(query.per_page) : 20,
    };
    const result = await this.salesOrderService.search(filters);
    return {
      success: true,
      data: result.data,
      meta: result.meta,
      message: 'OK',
    };
  }

  @Get(':id')
  @RequirePermissions('SALES.READ')
  async findById(@Param('id') id: string) {
    const so = await this.salesOrderService.findById(id as UUID);
    if (!so) return { success: false, message: 'Not found', data: null };
    return successResponse(so);
  }
}
