import { Controller, Get, Post, Delete, Body, Param, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CategoryService } from '../services/category.service';
import { successResponse } from '../../../common/types/api-response.type';

@ApiTags('Master Data - Categories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/master-data/categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @ApiOperation({ summary: 'Get all product categories' })
  @Get()
  async findAll() {
    const data = await this.categoryService.findAll();
    return successResponse(data);
  }

  @ApiOperation({ summary: 'Create a new category' })
  @Post()
  async create(@Body() body: { code: string; name: string; description?: string }) {
    const category = await this.categoryService.create(body);
    return successResponse(category, 'Kategori berhasil dibuat');
  }

  @ApiOperation({ summary: 'Delete a category' })
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async delete(@Param('id') id: string) {
    await this.categoryService.delete(id);
    return successResponse(null, 'Kategori berhasil dihapus');
  }
}
