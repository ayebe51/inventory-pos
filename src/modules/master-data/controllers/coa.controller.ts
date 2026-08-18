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
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { CoaService } from '../services/coa.service';
import { successResponse, paginatedResponse } from '../../../common/types/api-response.type';
import { UUID } from '../../../common/types/uuid.type';
import { CreateCOADTO, UpdateCOADTO, COAFilterDTO } from '../dto/coa.dto';

interface AuthRequest extends Request {
  user: { sub: string };
}

@ApiTags('Master Data - COA')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('api/v1/master-data/coa')
export class CoaController {
  constructor(private readonly coaService: CoaService) {}

  /**
   * POST /api/v1/master-data/coa
   */
  @ApiOperation({ summary: 'Create a new COA account' })
  @ApiBody({ type: CreateCOADTO })
  @Post()
  @RequirePermissions('ACCOUNTING.CREATE')
  async create(@Body() body: CreateCOADTO, @Request() req: AuthRequest) {
    const coa = await this.coaService.create(body as any, req.user.sub as UUID);
    return successResponse(coa, 'Akun COA berhasil dibuat');
  }

  /**
   * GET /api/v1/master-data/coa
   */
  @ApiOperation({ summary: 'Get all COA accounts with pagination and filters' })
  @Get()
  @RequirePermissions('ACCOUNTING.READ')
  async findAll(@Query() query: COAFilterDTO) {
    const filters = {
      account_type: query.account_type as any,
      is_header: query.is_header !== undefined ? String(query.is_header) === 'true' : undefined,
      is_active: query.is_active !== undefined ? String(query.is_active) === 'true' : undefined,
      parent_id: query.parent_id,
      branch_id: query.branch_id,
      search: query.search,
      page: query.page ? Number(query.page) : 1,
      per_page: query.per_page ? Number(query.per_page) : 20,
    };

    const result = await this.coaService.findAll(filters);
    return paginatedResponse(result.data, result.meta.total, result.meta.page, result.meta.per_page);
  }

  /**
   * GET /api/v1/master-data/coa/tree
   */
  @ApiOperation({ summary: 'Get COA tree hierarchy' })
  @ApiQuery({ name: 'branchId', required: false })
  @Get('tree')
  @RequirePermissions('ACCOUNTING.READ')
  async getTree(@Query('branchId') branchId?: string) {
    const tree = await this.coaService.getTree(branchId as UUID | undefined);
    return successResponse(tree);
  }

  /**
   * GET /api/v1/master-data/coa/:id
   */
  @ApiOperation({ summary: 'Get a COA account by ID' })
  @ApiParam({ name: 'id', description: 'COA ID' })
  @Get(':id')
  @RequirePermissions('ACCOUNTING.READ')
  async findById(@Param('id') id: string) {
    const coa = await this.coaService.findById(id as UUID);
    return successResponse(coa);
  }

  /**
   * PATCH /api/v1/master-data/coa/:id
   */
  @ApiOperation({ summary: 'Update an existing COA account' })
  @ApiParam({ name: 'id', description: 'COA ID' })
  @ApiBody({ type: UpdateCOADTO })
  @Patch(':id')
  @RequirePermissions('ACCOUNTING.UPDATE')
  async update(@Param('id') id: string, @Body() body: UpdateCOADTO, @Request() req: AuthRequest) {
    const coa = await this.coaService.update(id as UUID, body as any, req.user.sub as UUID);
    return successResponse(coa, 'Akun COA berhasil diperbarui');
  }

  /**
   * DELETE /api/v1/master-data/coa/:id
   */
  @ApiOperation({ summary: 'Soft delete a COA account' })
  @ApiParam({ name: 'id', description: 'COA ID' })
  @Delete(':id')
  @RequirePermissions('ACCOUNTING.DELETE')
  async softDelete(@Param('id') id: string, @Request() req: AuthRequest) {
    await this.coaService.softDelete(id as UUID, req.user.sub as UUID);
    return successResponse(null, 'Akun COA berhasil dihapus');
  }
}
