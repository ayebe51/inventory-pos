import {
  Body,
  Controller,
  Get,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { CashBankService } from '../services/cash-bank.service';
import { successResponse } from '../../../common/types/api-response.type';
import { UUID } from '../../../common/types/uuid.type';

interface AuthRequest extends Request {
  user: { sub: string };
}

@ApiTags('Finance - Cash & Bank')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('api/v1/finance/cash-bank')
export class CashBankController {
  constructor(private readonly cashBankService: CashBankService) {}

  @ApiOperation({ summary: 'Get current Cash & Bank position' })
  @Get('position')
  @RequirePermissions('JOURNAL.VIEW')
  async getPosition() {
    const data = await this.cashBankService.getCashPosition();
    return successResponse(data);
  }

  @ApiOperation({ summary: 'Record Cash In' })
  @Post('cash-in')
  @RequirePermissions('JOURNAL.CREATE')
  async recordCashIn(
    @Body('account_id') accountId: UUID,
    @Body('amount') amount: number,
    @Body('description') description: string,
    @Request() req: AuthRequest,
  ) {
    const data = await this.cashBankService.recordCashIn(accountId, amount, description, req.user.sub as UUID);
    return successResponse(data, 'Cash In recorded successfully');
  }

  @ApiOperation({ summary: 'Record Cash Out' })
  @Post('cash-out')
  @RequirePermissions('JOURNAL.CREATE')
  async recordCashOut(
    @Body('account_id') accountId: UUID,
    @Body('amount') amount: number,
    @Body('description') description: string,
    @Request() req: AuthRequest,
  ) {
    const data = await this.cashBankService.recordCashOut(accountId, amount, description, req.user.sub as UUID);
    return successResponse(data, 'Cash Out recorded successfully');
  }

  @ApiOperation({ summary: 'Record Transfer between accounts' })
  @Post('transfer')
  @RequirePermissions('JOURNAL.CREATE')
  async recordTransfer(
    @Body('from_account_id') fromAccountId: UUID,
    @Body('to_account_id') toAccountId: UUID,
    @Body('amount') amount: number,
    @Body('description') description: string,
    @Request() req: AuthRequest,
  ) {
    const data = await this.cashBankService.recordTransfer(
      fromAccountId,
      toAccountId,
      amount,
      description,
      req.user.sub as UUID,
    );
    return successResponse(data, 'Transfer recorded successfully');
  }
}
