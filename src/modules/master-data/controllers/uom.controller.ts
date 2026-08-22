import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { UOMService, CreateUOMDTO, UpdateUOMDTO } from '../services/uom.service';
import { successResponse } from '../../../common/types/api-response.type';
import { UUID } from '../../../common/types/uuid.type';

@ApiTags('Master Data - Units of Measure')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('api/v1/master-data/uoms')
export class UOMController {
  constructor(private readonly uomService: UOMService) {}

  @ApiOperation({ summary: 'Get all units of measure' })
  @Get()
  async findAll() {
    const data = await this.uomService.findAll();
    return successResponse(data, 'UOM list retrieved successfully');
  }

  @ApiOperation({ summary: 'Get unit of measure by ID' })
  @ApiParam({ name: 'id', description: 'UOM ID' })
  @Get(':id')
  async findById(@Param('id') id: string) {
    const data = await this.uomService.findById(id as UUID);
    return successResponse(data);
  }

  @ApiOperation({ summary: 'Create a new unit of measure' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'PCS' },
        name: { type: 'string', example: 'Pieces' },
        symbol: { type: 'string', example: 'pcs' },
      },
      required: ['code', 'name', 'symbol'],
    },
  })
  @Post()
  @RequirePermissions('PRODUCT.CREATE')
  async create(@Body() body: CreateUOMDTO) {
    const data = await this.uomService.create(body);
    return successResponse(data, 'Satuan berhasil dibuat');
  }

  @ApiOperation({ summary: 'Update a unit of measure' })
  @ApiParam({ name: 'id', description: 'UOM ID' })
  @Patch(':id')
  @RequirePermissions('PRODUCT.UPDATE')
  async update(@Param('id') id: string, @Body() body: UpdateUOMDTO) {
    const data = await this.uomService.update(id as UUID, body);
    return successResponse(data, 'Satuan berhasil diperbarui');
  }

  @ApiOperation({ summary: 'Delete a unit of measure' })
  @ApiParam({ name: 'id', description: 'UOM ID' })
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('PRODUCT.DELETE')
  async delete(@Param('id') id: string) {
    await this.uomService.delete(id as UUID);
    return successResponse(null, 'Satuan berhasil dihapus');
  }
}
