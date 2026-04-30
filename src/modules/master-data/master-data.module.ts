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
import { CustomerService } from './services/customer.service';
import { SupplierService } from './services/supplier.service';
import { WarehouseController } from './controllers/warehouse.controller';
import { OrganizationController } from './controllers/organization.controller';
import { CoaController } from './controllers/coa.controller';
import { ProductController } from './controllers/product.controller';
import { CustomerController } from './controllers/customer.controller';
import { SupplierController } from './controllers/supplier.controller';
import { PriceListController } from './controllers/price-list.controller';

@Module({
  imports: [ConfigModule],
  controllers: [
    WarehouseController,
    OrganizationController,
    CoaController,
    ProductController,
    CustomerController,
    SupplierController,
    PriceListController,
  ],
  providers: [
    PrismaService,
    AuditService,
    CacheService,
    ProductService,
    WarehouseService,
    OrganizationService,
    PriceListService,
    CoaService,
    CustomerService,
    SupplierService,
  ],
  exports: [
    ProductService,
    WarehouseService,
    OrganizationService,
    PriceListService,
    CoaService,
    CustomerService,
    SupplierService,
  ],
})
export class MasterDataModule {}
