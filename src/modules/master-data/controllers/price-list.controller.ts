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
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { PriceListService } from '../services/price-list.service';
import { successResponse, paginatedResponse } from '../../../common/types/api-response.type';
import { UUID } from '../../../common/types/uuid.type';
import { CreatePriceListDTO, UpdatePriceListDTO, UpdatePricesDTO, PriceListFilterDTO } from '../dto/price-list.dto';

interface AuthRequest extends Request {
  user: { sub: string };
}

@ApiTags('Master Data - Price Lists')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('api/v1/master-data/price-lists')
export class PriceListController {
  constructor(private readonly priceListService: PriceListService) {}

  /**
   * POST /api/v1/master-data/price-lists
   * Create a new price list
   */
  @ApiOperation({ summary: 'Create a new price list' })
  @ApiBody({ type: CreatePriceListDTO })
  @Post()
  @RequirePermissions('SALES.CREATE')
  async createPriceList(@Body() body: CreatePriceListDTO, @Request() req: AuthRequest) {
    const priceList = await this.priceListService.createPriceList(body as any, req.user.sub as UUID);
    return successResponse(priceList, 'Price list berhasil dibuat');
  }

  /**
   * GET /api/v1/master-data/price-lists
   * Search price lists with filters and pagination
   */
  @ApiOperation({ summary: 'Search price lists with filters and pagination' })
  @Get()
  @RequirePermissions('SALES.READ')
  async search(@Query() query: PriceListFilterDTO) {
    const filters = {
      customer_id: query.customer_id === 'null' ? null : query.customer_id,
      is_active: query.is_active !== undefined ? String(query.is_active) === 'true' : undefined,
      search: query.search,
      page: query.page ? Number(query.page) : 1,
      per_page: query.per_page ? Number(query.per_page) : 20,
    };

    const result = await this.priceListService.search(filters);
    return paginatedResponse(result.data, result.meta.total, result.meta.page, result.meta.per_page);
  }

  /**
   * GET /api/v1/master-data/price-lists/:id
   * Get price list by ID
   */
  @ApiOperation({ summary: 'Get price list by ID' })
  @ApiParam({ name: 'id', description: 'Price List ID' })
  @Get(':id')
  @RequirePermissions('SALES.READ')
  async findById(@Param('id') id: string) {
    const priceList = await this.priceListService.findById(id as UUID);
    return successResponse(priceList);
  }

  /**
   * GET /api/v1/master-data/price-lists/active-price
   * Get active price for a product on a specific date
   * Query params: product_id, customer_id (optional), date (ISO format)
   */
  @ApiOperation({ summary: 'Get active price for a product on a specific date' })
  @ApiQuery({ name: 'product_id', required: true, description: 'Product ID' })
  @ApiQuery({ name: 'customer_id', required: false, description: 'Customer ID' })
  @ApiQuery({ name: 'date', required: false, description: 'Date (ISO format)' })
  @Get('active-price')
  @RequirePermissions('SALES.READ')
  async getActivePrice(@Query() query: Record<string, string>) {
    const productId = query.product_id as UUID;
    const customerId = query.customer_id ? (query.customer_id as UUID) : null;
    const date = query.date ? new Date(query.date) : new Date();

    if (!productId) {
      return successResponse(null, 'product_id is required');
    }

    const result = await this.priceListService.getActivePrice(productId, customerId, date);
    return successResponse(result);
  }

  /**
   * PATCH /api/v1/master-data/price-lists/:id
   * Update an existing price list
   */
  @ApiOperation({ summary: 'Update an existing price list' })
  @ApiParam({ name: 'id', description: 'Price List ID' })
  @ApiBody({ type: UpdatePriceListDTO })
  @Patch(':id')
  @RequirePermissions('SALES.UPDATE')
  async updatePriceList(@Param('id') id: string, @Body() body: UpdatePriceListDTO, @Request() req: AuthRequest) {
    const priceList = await this.priceListService.updatePriceList(id as UUID, body as any, req.user.sub as UUID);
    return successResponse(priceList, 'Price list berhasil diperbarui');
  }

  /**
   * POST /api/v1/master-data/price-lists/:id/prices
   * Update prices for a price list (upsert price items)
   */
  @ApiOperation({ summary: 'Update prices for a price list (upsert price items)' })
  @ApiParam({ name: 'id', description: 'Price List ID' })
  @ApiBody({ type: UpdatePricesDTO })
  @Post(':id/prices')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('SALES.UPDATE')
  async updatePrices(@Param('id') id: string, @Body() body: UpdatePricesDTO, @Request() req: AuthRequest) {
    await this.priceListService.updatePrices(id as UUID, body.items as any[], req.user.sub as UUID);
    return successResponse(null, 'Harga berhasil diperbarui');
  }

  /**
   * DELETE /api/v1/master-data/price-lists/:id
   * Soft-delete a price list
   */
  @ApiOperation({ summary: 'Soft-delete a price list' })
  @ApiParam({ name: 'id', description: 'Price List ID' })
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('SALES.DELETE')
  async deactivate(@Param('id') id: string, @Request() req: AuthRequest) {
    await this.priceListService.deactivate(id as UUID, req.user.sub as UUID);
    return successResponse(null, 'Price list berhasil dinonaktifkan');
  }
}
