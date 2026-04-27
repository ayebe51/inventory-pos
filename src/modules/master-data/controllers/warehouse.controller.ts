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
import { WarehouseService } from '../services/warehouse.service';
import { successResponse, paginatedResponse } from '../../../common/types/api-response.type';
import { LockWarehouseSchema } from '../dto/warehouse.dto';
import { UUID } from '../../../common/types/uuid.type';

interface AuthRequest extends Request {
  user: { sub: string };
}

@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('api/v1/warehouses')
export class WarehouseController {
  constructor(private readonly warehouseService: WarehouseService) {}

  @Post()
  @RequirePermissions('INVENTORY.CREATE', 'ADMIN.SETTINGS')
  async create(@Body() body: unknown, @Request() req: AuthRequest) {
    const warehouse = await this.warehouseService.create(body as any, req.user.sub as UUID);
    return successResponse(warehouse, 'Gudang berhasil dibuat');
  }

  @Get()
  @RequirePermissions('INVENTORY.READ')
  async search(@Query() query: Record<string, string>) {
    const filters = {
      branch_id: query['branch_id'],
      is_active: query['is_active'] !== undefined ? query['is_active'] === 'true' : undefined,
      is_locked: query['is_locked'] !== undefined ? query['is_locked'] === 'true' : undefined,
      search: query['search'],
      page: query['page'] ? parseInt(query['page'], 10) : undefined,
      per_page: query['per_page'] ? parseInt(query['per_page'], 10) : undefined,
    };
    const result = await this.warehouseService.search(filters);
    return paginatedResponse(result.data, result.meta.total, result.meta.page, result.meta.per_page);
  }

  @Get(':id')
  @RequirePermissions('INVENTORY.READ')
  async findById(@Param('id') id: string) {
    const warehouse = await this.warehouseService.findById(id as UUID);
    return successResponse(warehouse);
  }

  @Patch(':id')
  @RequirePermissions('INVENTORY.UPDATE')
  async update(@Param('id') id: string, @Body() body: unknown, @Request() req: AuthRequest) {
    const warehouse = await this.warehouseService.update(id as UUID, body as any, req.user.sub as UUID);
    return successResponse(warehouse, 'Gudang berhasil diperbarui');
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('INVENTORY.DELETE')
  async deactivate(@Param('id') id: string, @Request() req: AuthRequest) {
    await this.warehouseService.deactivate(id as UUID, req.user.sub as UUID);
    return successResponse(null, 'Gudang berhasil dinonaktifkan');
  }

  @Post(':id/lock')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('STOCK.OPNAME')
  async lock(@Param('id') id: string, @Body() body: unknown, @Request() req: AuthRequest) {
    const validated = LockWarehouseSchema.parse(body);
    await this.warehouseService.lock(id as UUID, validated.reason, req.user.sub as UUID);
    return successResponse(null, 'Gudang berhasil dikunci');
  }

  @Post(':id/unlock')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('STOCK.OPNAME')
  async unlock(@Param('id') id: string, @Request() req: AuthRequest) {
    await this.warehouseService.unlock(id as UUID, req.user.sub as UUID);
    return successResponse(null, 'Gudang berhasil dibuka');
  }
}
