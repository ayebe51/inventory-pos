import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { CoaService } from '../services/coa.service';
import { successResponse, paginatedResponse } from '../../../common/types/api-response.type';
import { UUID } from '../../../common/types/uuid.type';

interface AuthRequest extends Request {
  user: { sub: string };
}

@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('api/v1/master-data/coa')
export class CoaController {
  constructor(private readonly coaService: CoaService) {}

  /**
   * POST /api/v1/master-data/coa
   */
  @Post()
  @RequirePermissions('ACCOUNTING.CREATE')
  async create(@Body() body: unknown, @Request() req: AuthRequest) {
    const coa = await this.coaService.create(body as any, req.user.sub as UUID);
    return successResponse(coa, 'Akun COA berhasil dibuat');
  }

  /**
   * GET /api/v1/master-data/coa
   */
  @Get()
  @RequirePermissions('ACCOUNTING.READ')
  async findAll(@Query() query: Record<string, string>) {
    const filters = {
      account_type: query.account_type as any,
      is_header: query.is_header !== undefined ? query.is_header === 'true' : undefined,
      is_active: query.is_active !== undefined ? query.is_active === 'true' : undefined,
      parent_id: query.parent_id,
      branch_id: query.branch_id,
      search: query.search,
      page: query.page ? parseInt(query.page, 10) : 1,
      per_page: query.per_page ? parseInt(query.per_page, 10) : 20,
    };

    const result = await this.coaService.findAll(filters);
    return paginatedResponse(result.data, result.meta.total, result.meta.page, result.meta.per_page);
  }

  /**
   * GET /api/v1/master-data/coa/tree
   */
  @Get('tree')
  @RequirePermissions('ACCOUNTING.READ')
  async getTree(@Query('branchId') branchId?: string) {
    const tree = await this.coaService.getTree(branchId as UUID | undefined);
    return successResponse(tree);
  }

  /**
   * GET /api/v1/master-data/coa/:id
   */
  @Get(':id')
  @RequirePermissions('ACCOUNTING.READ')
  async findById(@Param('id') id: string) {
    const coa = await this.coaService.findById(id as UUID);
    return successResponse(coa);
  }

  /**
   * PATCH /api/v1/master-data/coa/:id
   */
  @Patch(':id')
  @RequirePermissions('ACCOUNTING.UPDATE')
  async update(@Param('id') id: string, @Body() body: unknown, @Request() req: AuthRequest) {
    const coa = await this.coaService.update(id as UUID, body as any, req.user.sub as UUID);
    return successResponse(coa, 'Akun COA berhasil diperbarui');
  }

  /**
   * DELETE /api/v1/master-data/coa/:id
   */
  @Delete(':id')
  @RequirePermissions('ACCOUNTING.DELETE')
  async softDelete(@Param('id') id: string, @Request() req: AuthRequest) {
    await this.coaService.softDelete(id as UUID, req.user.sub as UUID);
    return successResponse(null, 'Akun COA berhasil dihapus');
  }
}
