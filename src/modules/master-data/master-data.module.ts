import { Module } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { AuditService } from '../../services/audit/audit.service';
import { ProductService } from './services/product.service';

@Module({
  providers: [PrismaService, AuditService, ProductService],
  exports: [ProductService],
})
export class MasterDataModule {}
