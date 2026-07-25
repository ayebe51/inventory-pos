import {
  Body,
  Controller,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { AccountingService } from '../services/accounting.service';
import { successResponse } from '../../../common/types/api-response.type';
import { UUID } from '../../../common/types/uuid.type';

interface AuthRequest extends Request {
  user: { sub: string };
}

@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('api/v1/accounting')
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  @Post('period/:id/close')
  @RequirePermissions('PERIOD.CLOSE')
  async closePeriod(@Param('id') id: string, @Request() req: AuthRequest) {
    const journal = await this.accountingService.closePeriod(id as UUID, req.user.sub as UUID);
    return successResponse(journal, 'Period closed and retained earnings calculated successfully');
  }
}
