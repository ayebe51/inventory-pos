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
import { ExpenseService, RecordExpenseDTO } from '../services/expense.service';
import { successResponse } from '../../../common/types/api-response.type';
import { UUID } from '../../../common/types/uuid.type';

interface AuthRequest extends Request {
  user: { sub: string };
}

@ApiTags('Finance - Expenses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('api/v1/finance/expenses')
export class ExpenseController {
  constructor(private readonly expenseService: ExpenseService) {}

  @ApiOperation({ summary: 'Record operational expense' })
  @Post()
  @RequirePermissions('JOURNAL.CREATE')
  async recordExpense(
    @Body() dto: RecordExpenseDTO,
    @Request() req: AuthRequest,
  ) {
    const data = await this.expenseService.recordExpense({
      ...dto,
      created_by: req.user.sub as UUID,
    });
    return successResponse(data, 'Expense recorded successfully');
  }

  @ApiOperation({ summary: 'Get expenses summary' })
  @Get('summary')
  @RequirePermissions('JOURNAL.VIEW')
  async getExpenseSummary(@Query('period_id') periodId?: UUID) {
    const data = await this.expenseService.getExpenseSummary(periodId);
    return successResponse(data);
  }
}
