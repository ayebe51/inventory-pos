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
import { ARService } from '../services/ar.service';
import { successResponse } from '../../../common/types/api-response.type';
import { UUID } from '../../../common/types/uuid.type';

interface AuthRequest extends Request {
  user: { sub: string };
}

@ApiTags('Finance - Accounts Receivable')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('api/v1/finance/ar')
export class ARController {
  constructor(private readonly arService: ARService) {}

  @ApiOperation({ summary: 'Get outstanding Accounts Receivable' })
  @Get('outstanding')
  @RequirePermissions('INVOICE.VIEW')
  async getOutstanding(@Query('branch_id') branchId?: UUID) {
    const data = await this.arService.getAROutstanding(branchId);
    return successResponse(data);
  }

  @ApiOperation({ summary: 'Write off bad debt AR invoice' })
  @Post('invoices/:id/write-off')
  @RequirePermissions('INVOICE.MANAGE')
  async writeOff(
    @Param('id') id: UUID,
    @Body('reason') reason: string,
    @Request() req: AuthRequest,
  ) {
    const result = await this.arService.writeOffAR(id, reason || 'Bad Debt Write-off', req.user.sub as UUID);
    return successResponse(result, 'Invoice written off successfully');
  }
}
