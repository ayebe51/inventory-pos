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
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { SupplierService } from '../services/supplier.service';
import { successResponse, paginatedResponse } from '../../../common/types/api-response.type';
import { UUID } from '../../../common/types/uuid.type';

interface AuthRequest extends Request {
  user: { sub: string };
}

@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('api/v1/master-data/suppliers')
export class SupplierController {
  constructor(private readonly supplierService: SupplierService) {}

  /**
   * POST /api/v1/master-data/suppliers
   * Create a new supplier
   */
  @Post()
  @RequirePermissions('PURCHASE.CREATE')
  async create(@Body() body: unknown, @Request() req: AuthRequest) {
    const supplier = await this.supplierService.create(body as any, req.user.sub as UUID);
    return successResponse(supplier, 'Supplier berhasil dibuat');
  }

  /**
   * GET /api/v1/master-data/suppliers
   * Search suppliers with filters and pagination
   */
  @Get()
  @RequirePermissions('PURCHASE.READ')
  async search(@Query() query: Record<string, string>) {
    const filters = {
      code: query.code,
      name: query.name,
      is_active: query.is_active !== undefined ? query.is_active === 'true' : undefined,
      page: query.page ? parseInt(query.page, 10) : 1,
      per_page: query.per_page ? parseInt(query.per_page, 10) : 20,
    };

    const result = await this.supplierService.search(filters);
    return paginatedResponse(result.data, result.meta.total, result.meta.page, result.meta.per_page);
  }

  /**
   * GET /api/v1/master-data/suppliers/:id
   * Get supplier by ID
   */
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
  @Patch(':id')
  @RequirePermissions('PURCHASE.UPDATE')
  async update(@Param('id') id: string, @Body() body: unknown, @Request() req: AuthRequest) {
    const supplier = await this.supplierService.update(id as UUID, body as any, req.user.sub as UUID);
    return successResponse(supplier, 'Supplier berhasil diperbarui');
  }

  /**
   * DELETE /api/v1/master-data/suppliers/:id
   * Soft-delete a supplier
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('PURCHASE.DELETE')
  async deactivate(@Param('id') id: string, @Request() req: AuthRequest) {
    await this.supplierService.deactivate(id as UUID, req.user.sub as UUID);
    return successResponse(null, 'Supplier berhasil dinonaktifkan');
  }
}
