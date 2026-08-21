import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { APService } from '../services/ap.service';
import { successResponse } from '../../../common/types/api-response.type';
import { UUID } from '../../../common/types/uuid.type';

interface AuthRequest extends Request {
  user: { sub: string };
}

@ApiTags('Finance - Accounts Payable')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('api/v1/finance/ap')
export class APController {
  constructor(private readonly apService: APService) {}

  @ApiOperation({ summary: 'Get outstanding Accounts Payable' })
  @Get('outstanding')
  @RequirePermissions('INVOICE.VIEW')
  async getOutstanding(@Query('branch_id') branchId?: UUID) {
    const data = await this.apService.getAPOutstanding(branchId);
    return successResponse(data);
  }

  @ApiOperation({ summary: 'Record payment to supplier' })
  @Post('invoices/:id/payment')
  @RequirePermissions('INVOICE.MANAGE')
  async recordPayment(
    @Param('id') id: UUID,
    @Body('amount') amount: number,
    @Body('payment_method_id') paymentMethodId: UUID,
    @Body('reference_number') referenceNumber: string,
    @Request() req: AuthRequest,
  ) {
    const result = await this.apService.recordSupplierPayment(
      id,
      amount,
      paymentMethodId,
      req.user.sub as UUID,
      referenceNumber,
    );
    return successResponse(result, 'Supplier payment recorded successfully');
  }
}
