import {
  Body,
  Controller,
  Param,
  Post,
  Get,
  Request,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { SalesOrderService } from '../services/sales-order.service';
import { successResponse } from '../../../common/types/api-response.type';
import { UUID } from '../../../common/types/uuid.type';
import { CreateSODTO, FulfillmentDTO, SalesReturnDTO } from '../dto/pos.dto';

interface AuthRequest extends Request {
  user: { sub: string };
}

@ApiTags('POS - Sales Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('api/v1/sales-orders')
export class SalesOrderController {
  constructor(private readonly salesOrderService: SalesOrderService) {}

  @ApiOperation({ summary: 'Create a Sales Order' })
  @ApiBody({ type: CreateSODTO })
  @Post()
  @RequirePermissions('SALES.CREATE')
  async create(@Body() body: CreateSODTO, @Request() req: AuthRequest) {
    const so = await this.salesOrderService.create(body as any);
    return successResponse(so, 'Sales Order created successfully');
  }

  @ApiOperation({ summary: 'Approve a Sales Order' })
  @ApiParam({ name: 'id', description: 'Sales Order ID' })
  @Post(':id/approve')
  @RequirePermissions('SALES.APPROVE')
  async approve(@Param('id') id: string, @Request() req: AuthRequest) {
    const so = await this.salesOrderService.approve(id as UUID, req.user.sub as UUID);
    return successResponse(so, 'Sales Order approved successfully');
  }

  @ApiOperation({ summary: 'Fulfill a Sales Order' })
  @ApiParam({ name: 'id', description: 'Sales Order ID' })
  @ApiBody({ type: FulfillmentDTO })
  @Post(':id/fulfill')
  @RequirePermissions('SALES.FULFILL')
  async fulfill(@Param('id') id: string, @Body() data: FulfillmentDTO) {
    const deliveryOrder = await this.salesOrderService.fulfill(id as UUID, data as any);
    return successResponse(deliveryOrder, 'Sales Order fulfilled and Delivery Order created');
  }

  @ApiOperation({ summary: 'Create a Sales Return' })
  @ApiParam({ name: 'id', description: 'Sales Order ID' })
  @ApiBody({ type: SalesReturnDTO })
  @Post(':id/return')
  @RequirePermissions('SALES.RETURN')
  async createReturn(@Param('id') id: string, @Body() data: SalesReturnDTO) {
    const sr = await this.salesOrderService.createReturn(id as UUID, data as any);
    return successResponse(sr, 'Sales Return created successfully');
  }

  @ApiOperation({ summary: 'Search Sales Orders' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'customer_id', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'per_page', required: false })
  @Get()
  @RequirePermissions('SALES.READ')
  async search(@Query() query: { status?: string; customer_id?: string; page?: string; per_page?: string }) {
    const filters = {
      status: query.status,
      customer_id: query.customer_id,
      page: query.page ? parseInt(query.page) : 1,
      per_page: query.per_page ? parseInt(query.per_page) : 20,
    };
    const result = await (this.salesOrderService as any).search?.(filters);
    if (!result) {
        return { success: true, data: [], meta: { total: 0, page: filters.page, per_page: filters.per_page }, message: 'OK' };
    }
    return {
      success: true,
      data: result.data,
      meta: result.meta,
      message: 'OK',
    };
  }

  @ApiOperation({ summary: 'List all Delivery Orders' })
  @ApiQuery({ name: 'so_id', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'per_page', required: false })
  @Get('delivery-orders/list')
  @RequirePermissions('SALES.READ')
  async listDeliveryOrders(
    @Query('so_id') soId?: string,
    @Query('page') page?: string,
    @Query('per_page') perPage?: string,
  ) {
    const result = await this.salesOrderService.listDeliveryOrders({
      so_id: soId as UUID,
      page: page ? parseInt(page, 10) : 1,
      per_page: perPage ? parseInt(perPage, 10) : 20,
    });
    return successResponse(result.data, 'Delivery orders retrieved successfully', result.meta);
  }

  @ApiOperation({ summary: 'Get Delivery Order by ID' })
  @ApiParam({ name: 'id', description: 'Delivery Order ID' })
  @Get('delivery-orders/:id')
  @RequirePermissions('SALES.READ')
  async getDeliveryOrder(@Param('id') id: string) {
    const doRecord = await this.salesOrderService.getDeliveryOrderById(id as UUID);
    if (!doRecord) return { success: false, message: 'Delivery Order not found', data: null as any };
    return successResponse(doRecord);
  }

  @ApiOperation({ summary: 'Get Sales Order by ID' })
  @ApiParam({ name: 'id', description: 'Sales Order ID' })
  @Get(':id')
  @RequirePermissions('SALES.READ')
  async findById(@Param('id') id: string) {
    const so = await (this.salesOrderService as any).findById?.(id as UUID);
    if (!so) return { success: false, message: 'Not found', data: null as any };
    return successResponse(so);
  }
}
