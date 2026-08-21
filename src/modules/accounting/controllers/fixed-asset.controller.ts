import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FixedAssetService } from '../services/fixed-asset.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';

@ApiTags('Accounting - Fixed Assets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('api/v1/accounting/assets')
export class FixedAssetController {
  constructor(private readonly fixedAssetService: FixedAssetService) {}

  @Get()
  @RequirePermissions('FINANCE.MANAGE')
  @ApiOperation({ summary: 'Get all fixed assets' })
  async findAll() {
    return this.fixedAssetService.findAll();
  }

  @Post()
  @RequirePermissions('FINANCE.MANAGE')
  @ApiOperation({ summary: 'Create new fixed asset' })
  async create(@Body() data: any, @Req() req: any) {
    return this.fixedAssetService.create(data, req.user.branch_id);
  }

  @Post('run-depreciation')
  @RequirePermissions('FINANCE.MANAGE')
  @ApiOperation({ summary: 'Run monthly depreciation for all active assets' })
  async runDepreciation(@Req() req: any) {
    return this.fixedAssetService.runDepreciation(req.user.branch_id, req.user.id);
  }
}
