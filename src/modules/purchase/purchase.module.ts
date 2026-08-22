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
import { PurchaseReturnService } from './services/purchase-return.service';
import { PurchaseRequestController } from './controllers/purchase-request.controller';
import { PurchaseOrderController } from './controllers/purchase-order.controller';
import { GoodsReceiptController } from './controllers/goods-receipt.controller';
import { PurchaseReturnController } from './controllers/purchase-return.controller';

import { JournalEngineService } from '../../services/journal-engine/journal-engine.service';
import { PeriodManagerService } from '../../services/period-manager/period-manager.service';

@Module({
  controllers: [
    PurchaseRequestController,
    PurchaseOrderController,
    GoodsReceiptController,
    PurchaseReturnController,
  ],
  providers: [
    PrismaService,
    AuditService,
    NumberingService,
    RbacService,
    CacheService,
    JournalEngineService,
    PeriodManagerService,
    PurchaseRequestService,
    PurchaseOrderService,
    GoodsReceiptService,
    ThreeWayMatchingService,
    PurchaseReturnService,
  ],
  exports: [
    PurchaseRequestService,
    PurchaseOrderService,
    GoodsReceiptService,
    ThreeWayMatchingService,
    PurchaseReturnService,
  ],
})
export class PurchaseModule {}
