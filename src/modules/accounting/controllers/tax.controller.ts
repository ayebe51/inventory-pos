import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { TaxService } from '../services/tax.service';
import { successResponse } from '../../../common/types/api-response.type';
import { UUID } from '../../../common/types/uuid.type';

interface AuthRequest extends Request {
  user: { sub: string };
}

@ApiTags('Finance - Tax Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('api/v1/finance/tax')
export class TaxController {
  constructor(private readonly taxService: TaxService) {}

  @ApiOperation({ summary: 'Get PPN tax summary' })
  @Get('summary')
  @RequirePermissions('JOURNAL.VIEW')
  async getTaxSummary(@Query('period_id') periodId?: UUID) {
    const data = await this.taxService.getTaxSummary(periodId);
    return successResponse(data);
  }

  @ApiOperation({ summary: 'Record PPN tax payment' })
  @Post('payment')
  @RequirePermissions('JOURNAL.CREATE')
  async recordTaxPayment(
    @Body('amount') amount: number,
    @Body('bank_account_id') bankAccountId: UUID,
    @Request() req: AuthRequest,
  ) {
    const data = await this.taxService.recordTaxPayment(amount, bankAccountId, req.user.sub as UUID);
    return successResponse(data, 'Tax payment recorded successfully');
  }
}
