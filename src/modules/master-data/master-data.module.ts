import { Module } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { AuditService } from '../../services/audit/audit.service';
import { ProductService } from './services/product.service';
import { WarehouseService } from './services/warehouse.service';
import { WarehouseController } from './controllers/warehouse.controller';

@Module({
  controllers: [WarehouseController],
  providers: [PrismaService, AuditService, ProductService, WarehouseService],
  exports: [ProductService, WarehouseService],
})
export class MasterDataModule {}
