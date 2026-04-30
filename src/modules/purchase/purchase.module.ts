import { Module } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { AuditService } from '../../services/audit/audit.service';
import { NumberingService } from '../../services/numbering/numbering.service';
import { PurchaseRequestService } from './services/purchase-request.service';

@Module({
  providers: [PrismaService, AuditService, NumberingService, PurchaseRequestService],
  exports: [PurchaseRequestService],
})
export class PurchaseModule {}
