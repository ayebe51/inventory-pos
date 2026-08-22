import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { ARService } from '../services/ar.service';
import { successResponse } from '../../../common/types/api-response.type';
import { UUID } from '../../../common/types/uuid.type';

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
}
