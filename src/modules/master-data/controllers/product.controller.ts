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
import { ProductService } from '../services/product.service';
import { successResponse, paginatedResponse } from '../../../common/types/api-response.type';
import { UUID } from '../../../common/types/uuid.type';

interface AuthRequest extends Request {
  user: { sub: string };
}

@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('api/v1/master-data/products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  /**
   * POST /api/v1/master-data/products
   * Create a new product
   */
  @Post()
  @RequirePermissions('INVENTORY.CREATE')
  async create(@Body() body: unknown, @Request() req: AuthRequest) {
    const product = await this.productService.create(body as any, req.user.sub as UUID);
    return successResponse(product, 'Produk berhasil dibuat');
  }

  /**
   * GET /api/v1/master-data/products
   * Search products with filters and pagination
   */
  @Get()
  @RequirePermissions('INVENTORY.READ')
  async search(@Query() query: Record<string, string>) {
    const filters = {
      code: query.code,
      name: query.name,
      category_id: query.category_id,
      brand_id: query.brand_id,
      is_active: query.is_active !== undefined ? query.is_active === 'true' : undefined,
      page: query.page ? parseInt(query.page, 10) : 1,
      per_page: query.per_page ? parseInt(query.per_page, 10) : 20,
    };

    const result = await this.productService.search(filters);
    return paginatedResponse(result.data, result.meta.total, result.meta.page, result.meta.per_page);
  }

  /**
   * GET /api/v1/master-data/products/:id
   * Get product by ID
   */
  @Get(':id')
  @RequirePermissions('INVENTORY.READ')
  async findById(@Param('id') id: string) {
    const product = await this.productService.findById(id as UUID);
    return successResponse(product);
  }

  /**
   * PATCH /api/v1/master-data/products/:id
   * Update an existing product
   */
  @Patch(':id')
  @RequirePermissions('INVENTORY.UPDATE')
  async update(@Param('id') id: string, @Body() body: unknown, @Request() req: AuthRequest) {
    const product = await this.productService.update(id as UUID, body as any, req.user.sub as UUID);
    return successResponse(product, 'Produk berhasil diperbarui');
  }

  /**
   * DELETE /api/v1/master-data/products/:id
   * Soft-delete a product
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('INVENTORY.DELETE')
  async deactivate(@Param('id') id: string, @Request() req: AuthRequest) {
    await this.productService.deactivate(id as UUID, req.user.sub as UUID);
    return successResponse(null, 'Produk berhasil dinonaktifkan');
  }
}
