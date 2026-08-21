import { Module } from '@nestjs/common';
import { AuditService } from '../../services/audit/audit.service';
import { AuditController } from '../../services/audit/audit.controller';
import { PrismaService } from '../../config/prisma.service';
import { RbacModule } from '../../services/rbac/rbac.module';
import { ApprovalEngineModule } from '../../services/approval-engine/approval-engine.module';
import { AdminController } from './controllers/admin.controller';
import { AdminService } from './services/admin.service';

@Module({
  imports: [RbacModule, ApprovalEngineModule],
  controllers: [AuditController, AdminController],
  providers: [AuditService, PrismaService, AdminService],
  exports: [AuditService, ApprovalEngineModule],
})
export class GovernanceModule {}
