import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../../config/prisma.service';
import { AuditService } from '../../services/audit/audit.service';
import { CacheService } from '../../services/cache/cache.service';
import { ProductService } from './services/product.service';
import { WarehouseService } from './services/warehouse.service';
import { OrganizationService } from './services/organization.service';
import { PriceListService } from './services/price-list.service';
import { CoaService } from './services/coa.service';
import { WarehouseController } from './controllers/warehouse.controller';
import { OrganizationController } from './controllers/organization.controller';
import { CoaController } from './controllers/coa.controller';

@Module({
  imports: [ConfigModule],
  controllers: [WarehouseController, OrganizationController, CoaController],
  providers: [
    PrismaService,
    AuditService,
    CacheService,
    ProductService,
    WarehouseService,
    OrganizationService,
    PriceListService,
    CoaService,
  ],
  exports: [ProductService, WarehouseService, OrganizationService, PriceListService, CoaService],
})
export class MasterDataModule {}
