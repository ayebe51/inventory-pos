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
import { CustomerService } from '../services/customer.service';
import { successResponse, paginatedResponse } from '../../../common/types/api-response.type';
import { UUID } from '../../../common/types/uuid.type';
import { CreateCustomerDTO, UpdateCustomerDTO, CustomerFilter } from '../dto/customer.dto';

interface AuthRequest extends Request {
  user: { sub: string };
}

@ApiTags('Master Data - Customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('api/v1/master-data/customers')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  /**
   * POST /api/v1/master-data/customers
   * Create a new customer
   */
  @ApiOperation({ summary: 'Create a new customer' })
  @ApiBody({ type: CreateCustomerDTO })
  @Post()
  @RequirePermissions('SALES.CREATE')
  async create(@Body() body: CreateCustomerDTO, @Request() req: AuthRequest) {
    const customer = await this.customerService.create(body as any, req.user.sub as UUID);
    return successResponse(customer, 'Customer berhasil dibuat');
  }

  /**
   * GET /api/v1/master-data/customers
   * Search customers with filters and pagination
   */
  @ApiOperation({ summary: 'Search customers with filters and pagination' })
  @Get()
  @RequirePermissions('SALES.READ')
  async search(@Query() query: CustomerFilter) {
    const filters = {
      code: query.code,
      name: query.name,
      is_active: query.is_active !== undefined ? String(query.is_active) === 'true' : undefined,
      page: query.page ? Number(query.page) : 1,
      per_page: query.per_page ? Number(query.per_page) : 20,
    };

    const result = await this.customerService.search(filters);
    return paginatedResponse(result.data, result.meta.total, result.meta.page, result.meta.per_page);
  }

  /**
   * GET /api/v1/master-data/customers/:id
   * Get customer by ID
   */
  @ApiOperation({ summary: 'Get customer by ID' })
  @ApiParam({ name: 'id', description: 'Customer ID' })
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
  @ApiOperation({ summary: 'Get remaining credit limit for a customer' })
  @ApiParam({ name: 'id', description: 'Customer ID' })
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
  @ApiOperation({ summary: 'Update an existing customer' })
  @ApiParam({ name: 'id', description: 'Customer ID' })
  @ApiBody({ type: UpdateCustomerDTO })
  @Patch(':id')
  @RequirePermissions('SALES.UPDATE')
  async update(@Param('id') id: string, @Body() body: UpdateCustomerDTO, @Request() req: AuthRequest) {
    const customer = await this.customerService.update(id as UUID, body as any, req.user.sub as UUID);
    return successResponse(customer, 'Customer berhasil diperbarui');
  }

  /**
   * DELETE /api/v1/master-data/customers/:id
   * Soft-delete a customer
   */
  @ApiOperation({ summary: 'Soft-delete a customer' })
  @ApiParam({ name: 'id', description: 'Customer ID' })
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('SALES.DELETE')
  async deactivate(@Param('id') id: string, @Request() req: AuthRequest) {
    await this.customerService.deactivate(id as UUID, req.user.sub as UUID);
    return successResponse(null, 'Customer berhasil dinonaktifkan');
  }
}
