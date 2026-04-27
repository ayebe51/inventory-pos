import { Module } from '@nestjs/common';
import { AuditService } from '../../services/audit/audit.service';
import { AuditController } from '../../services/audit/audit.controller';
import { PrismaService } from '../../config/prisma.service';
import { RbacModule } from '../../services/rbac/rbac.module';
import { ApprovalEngineModule } from '../../services/approval-engine/approval-engine.module';

@Module({
  imports: [RbacModule, ApprovalEngineModule],
  controllers: [AuditController],
  providers: [AuditService, PrismaService],
  exports: [AuditService, ApprovalEngineModule],
})
export class GovernanceModule {}
