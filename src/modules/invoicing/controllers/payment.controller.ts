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
import { PaymentService } from '../services/payment.service';
import { successResponse } from '../../../common/types/api-response.type';
import { UUID } from '../../../common/types/uuid.type';
import { CreatePaymentDTO } from '../interfaces/invoicing.interfaces';

interface AuthRequest extends Request {
  user: { sub: string };
}

@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('api/v1/payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  @RequirePermissions('PAYMENT.CREATE')
  async registerPayment(@Body() body: CreatePaymentDTO, @Request() req: AuthRequest) {
    const payment = await this.paymentService.createPayment(body);
    return successResponse(payment, 'Payment registered successfully');
  }

  @Post(':id/approve')
  @RequirePermissions('PAYMENT.APPROVE')
  async approve(@Param('id') id: string, @Request() req: AuthRequest) {
    const payment = await this.paymentService.approve(id as UUID, req.user.sub as UUID);
    return successResponse(payment, 'Payment approved successfully');
  }

  @Post(':id/post')
  @RequirePermissions('PAYMENT.POST')
  async post(@Param('id') id: string, @Request() req: AuthRequest) {
    const payment = await this.paymentService.post(id as UUID, req.user.sub as UUID);
    return successResponse(payment, 'Payment posted successfully');
  }

  @Post(':id/reverse')
  @RequirePermissions('PAYMENT.REVERSE')
  async reverse(@Param('id') id: string, @Body('reason') reason: string, @Request() req: AuthRequest) {
    const payment = await this.paymentService.reverse(id as UUID, req.user.sub as UUID, reason);
    return successResponse(payment, 'Payment reversed successfully');
  }

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

  @Get(':id')
  @RequirePermissions('PAYMENT.READ')
  async findById(@Param('id') id: string) {
    const payment = await this.paymentService.findById(id as UUID);
    if (!payment) return { success: false, message: 'Not found', data: null };
    return successResponse(payment);
  }
}
