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
import { CustomerService } from '../services/customer.service';
import { successResponse, paginatedResponse } from '../../../common/types/api-response.type';
import { UUID } from '../../../common/types/uuid.type';

interface AuthRequest extends Request {
  user: { sub: string };
}

@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('api/v1/master-data/customers')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  /**
   * POST /api/v1/master-data/customers
   * Create a new customer
   */
  @Post()
  @RequirePermissions('SALES.CREATE')
  async create(@Body() body: unknown, @Request() req: AuthRequest) {
    const customer = await this.customerService.create(body as any, req.user.sub as UUID);
    return successResponse(customer, 'Customer berhasil dibuat');
  }

  /**
   * GET /api/v1/master-data/customers
   * Search customers with filters and pagination
   */
  @Get()
  @RequirePermissions('SALES.READ')
  async search(@Query() query: Record<string, string>) {
    const filters = {
      code: query.code,
      name: query.name,
      is_active: query.is_active !== undefined ? query.is_active === 'true' : undefined,
      page: query.page ? parseInt(query.page, 10) : 1,
      per_page: query.per_page ? parseInt(query.per_page, 10) : 20,
    };

    const result = await this.customerService.search(filters);
    return paginatedResponse(result.data, result.meta.total, result.meta.page, result.meta.per_page);
  }

  /**
   * GET /api/v1/master-data/customers/:id
   * Get customer by ID
   */
  @Get(':id')
  @RequirePermissions('SALES.READ')
  async findById(@Param('id') id: string) {
    const customer = await this.customerService.findById(id as UUID);
    return successResponse(customer);
  }

  /**
   * GET /api/v1/master-data/customers/:id/credit
   * Get remaining credit limit for a customer
   */
  @Get(':id/credit')
  @RequirePermissions('SALES.READ')
  async getRemainingCredit(@Param('id') id: string) {
    const remaining = await this.customerService.getRemainingCredit(id as UUID);
    return successResponse({ remaining_credit: remaining });
  }

  /**
   * PATCH /api/v1/master-data/customers/:id
   * Update an existing customer
   */
  @Patch(':id')
  @RequirePermissions('SALES.UPDATE')
  async update(@Param('id') id: string, @Body() body: unknown, @Request() req: AuthRequest) {
    const customer = await this.customerService.update(id as UUID, body as any, req.user.sub as UUID);
    return successResponse(customer, 'Customer berhasil diperbarui');
  }

  /**
   * DELETE /api/v1/master-data/customers/:id
   * Soft-delete a customer
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('SALES.DELETE')
  async deactivate(@Param('id') id: string, @Request() req: AuthRequest) {
    await this.customerService.deactivate(id as UUID, req.user.sub as UUID);
    return successResponse(null, 'Customer berhasil dinonaktifkan');
  }
}
