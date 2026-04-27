import { Module } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { AuditService } from '../../services/audit/audit.service';
import { ProductService } from './services/product.service';
import { WarehouseService } from './services/warehouse.service';
import { OrganizationService } from './services/organization.service';
import { WarehouseController } from './controllers/warehouse.controller';
import { OrganizationController } from './controllers/organization.controller';

@Module({
  controllers: [WarehouseController, OrganizationController],
  providers: [PrismaService, AuditService, ProductService, WarehouseService, OrganizationService],
  exports: [ProductService, WarehouseService, OrganizationService],
})
export class MasterDataModule {}
