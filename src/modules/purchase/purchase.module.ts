import { Module } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { AuditService } from '../../services/audit/audit.service';
import { NumberingService } from '../../services/numbering/numbering.service';
import { RbacService } from '../../services/rbac/rbac.service';
import { CacheService } from '../../services/cache/cache.service';
import { PurchaseRequestService } from './services/purchase-request.service';
import { PurchaseOrderService } from './services/purchase-order.service';
import { GoodsReceiptService } from './services/goods-receipt.service';
import { ThreeWayMatchingService } from './services/three-way-matching.service';
import { PurchaseOrderController } from './controllers/purchase-order.controller';

@Module({
  controllers: [PurchaseOrderController],
  providers: [
    PrismaService,
    AuditService,
    NumberingService,
    RbacService,
    CacheService,
    PurchaseRequestService,
    PurchaseOrderService,
    GoodsReceiptService,
    ThreeWayMatchingService,
  ],
  exports: [PurchaseRequestService, PurchaseOrderService, GoodsReceiptService, ThreeWayMatchingService],
})
export class PurchaseModule {}
