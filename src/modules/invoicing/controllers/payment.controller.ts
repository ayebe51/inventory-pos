import {
  Body,
  Controller,
  Param,
  Post,
  Get,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { PaymentService } from '../services/payment.service';
import { successResponse } from '../../../common/types/api-response.type';
import { UUID } from '../../../common/types/uuid.type';
import { CreatePaymentDTO } from '../dto/invoicing.dto';

interface AuthRequest extends Request {
  user: { sub: string };
}

import { UseInterceptors } from '@nestjs/common';
import { IdempotencyInterceptor } from '../../../common/interceptors/idempotency.interceptor';
import { UseIdempotency } from '../../../common/decorators/idempotency.decorator';

@ApiTags('Invoicing - Payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@UseInterceptors(IdempotencyInterceptor)
@UseIdempotency()
@Controller('api/v1/payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @ApiOperation({ summary: 'Register a payment' })
  @ApiBody({ type: CreatePaymentDTO })
  @Post()
  @RequirePermissions('PAYMENT.CREATE')
  async registerPayment(@Body() body: CreatePaymentDTO, @Request() req: AuthRequest) {
    const payment = await this.paymentService.createPayment(body as any, req.user?.sub as UUID);
    return successResponse(payment, 'Payment registered successfully');
  }

  @ApiOperation({ summary: 'Approve a payment' })
  @ApiParam({ name: 'id', description: 'Payment ID' })
  @Post(':id/approve')
  @RequirePermissions('PAYMENT.APPROVE')
  async approve(@Param('id') id: string, @Request() req: AuthRequest) {
    const payment = await this.paymentService.approve(id as UUID, req.user.sub as UUID);
    return successResponse(payment, 'Payment approved successfully');
  }

  @ApiOperation({ summary: 'Post a payment' })
  @ApiParam({ name: 'id', description: 'Payment ID' })
  @Post(':id/post')
  @RequirePermissions('PAYMENT.POST')
  async post(@Param('id') id: string, @Request() req: AuthRequest) {
    const payment = await this.paymentService.post(id as UUID, req.user.sub as UUID);
    return successResponse(payment, 'Payment posted successfully');
  }

  @ApiOperation({ summary: 'Reverse a payment' })
  @ApiParam({ name: 'id', description: 'Payment ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', example: 'Wrong amount' }
      }
    }
  })
  @Post(':id/reverse')
  @RequirePermissions('PAYMENT.REVERSE')
  async reverse(@Param('id') id: string, @Body('reason') reason: string, @Request() req: AuthRequest) {
    const payment = await this.paymentService.reverse(id as UUID, req.user.sub as UUID, reason);
    return successResponse(payment, 'Payment reversed successfully');
  }

  @ApiOperation({ summary: 'Search payments' })
  @ApiQuery({ name: 'payment_type', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'customer_id', required: false })
  @ApiQuery({ name: 'supplier_id', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'per_page', required: false })
  @Get()
  @RequirePermissions('PAYMENT.READ')
  async search(@Request() req: Request) {
    const query = (req as any).query;
    const filters = {
      payment_type: query.payment_type,
      status: query.status,
      customer_id: query.customer_id,
      supplier_id: query.supplier_id,
      page: query.page ? parseInt(query.page) : 1,
      per_page: query.per_page ? parseInt(query.per_page) : 20,
    };
    const result = await this.paymentService.search(filters);
    return {
      success: true,
      data: result.data,
      meta: result.meta,
      message: 'OK',
    };
  }

  @ApiOperation({ summary: 'Get payment by ID' })
  @ApiParam({ name: 'id', description: 'Payment ID' })
  @Get(':id')
  @RequirePermissions('PAYMENT.READ')
  async findById(@Param('id') id: string) {
    const payment = await this.paymentService.findById(id as UUID);
    if (!payment) return { success: false, message: 'Not found', data: null };
    return successResponse(payment);
  }
}
