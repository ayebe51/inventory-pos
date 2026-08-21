import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { SupplierService } from '../services/supplier.service';
import { successResponse, paginatedResponse } from '../../../common/types/api-response.type';
import { UUID } from '../../../common/types/uuid.type';
import { CreateSupplierDTO, UpdateSupplierDTO, SupplierFilter } from '../dto/supplier.dto';

interface AuthRequest extends Request {
  user: { sub: string };
}

@ApiTags('Master Data - Suppliers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('api/v1/master-data/suppliers')
export class SupplierController {
  constructor(private readonly supplierService: SupplierService) {}

  /**
   * POST /api/v1/master-data/suppliers
   * Create a new supplier
   */
  @ApiOperation({ summary: 'Create a new supplier' })
  @ApiBody({ type: CreateSupplierDTO })
  @Post()
  @RequirePermissions('PURCHASE.CREATE')
  async create(@Body() body: CreateSupplierDTO, @Request() req: AuthRequest) {
    const supplier = await this.supplierService.create(body as any, req.user.sub as UUID);
    return successResponse(supplier, 'Supplier berhasil dibuat');
  }

  /**
   * GET /api/v1/master-data/suppliers
   * Search suppliers with filters and pagination
   */
  @ApiOperation({ summary: 'Search suppliers with filters and pagination' })
  @Get()
  @RequirePermissions('PURCHASE.READ')
  async search(@Query() query: SupplierFilter) {
    const filters = {
      code: query.code,
      name: query.name,
      is_active: query.is_active !== undefined ? String(query.is_active) === 'true' : undefined,
      page: query.page ? Number(query.page) : 1,
      per_page: query.per_page ? Number(query.per_page) : 20,
    };

    const result = await this.supplierService.search(filters);
    return paginatedResponse(result.data, result.meta.total, result.meta.page, result.meta.per_page);
  }

  /**
   * GET /api/v1/master-data/suppliers/:id
   * Get supplier by ID
   */
  @ApiOperation({ summary: 'Get supplier by ID' })
  @ApiParam({ name: 'id', description: 'Supplier ID' })
  @Get(':id')
  @RequirePermissions('PURCHASE.READ')
  async findById(@Param('id') id: string) {
    const supplier = await this.supplierService.findById(id as UUID);
    return successResponse(supplier);
  }

  /**
   * PATCH /api/v1/master-data/suppliers/:id
   * Update an existing supplier
   */
  @ApiOperation({ summary: 'Update an existing supplier' })
  @ApiParam({ name: 'id', description: 'Supplier ID' })
  @ApiBody({ type: UpdateSupplierDTO })
  @Patch(':id')
  @RequirePermissions('PURCHASE.UPDATE')
  async update(@Param('id') id: string, @Body() body: UpdateSupplierDTO, @Request() req: AuthRequest) {
    const supplier = await this.supplierService.update(id as UUID, body as any, req.user.sub as UUID);
    return successResponse(supplier, 'Supplier berhasil diperbarui');
  }

  /**
   * DELETE /api/v1/master-data/suppliers/:id
   * Soft-delete a supplier
   */
  @ApiOperation({ summary: 'Soft-delete a supplier' })
  @ApiParam({ name: 'id', description: 'Supplier ID' })
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('PURCHASE.DELETE')
  async deactivate(@Param('id') id: string, @Request() req: AuthRequest) {
    await this.supplierService.deactivate(id as UUID, req.user.sub as UUID);
    return successResponse(null, 'Supplier berhasil dinonaktifkan');
  }
}
