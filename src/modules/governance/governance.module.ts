import { Module } from '@nestjs/common';
import { AuditService } from '../../services/audit/audit.service';
import { AuditController } from '../../services/audit/audit.controller';
import { PrismaService } from '../../config/prisma.service';
import { RbacModule } from '../../services/rbac/rbac.module';

@Module({
  imports: [RbacModule],
  controllers: [AuditController],
  providers: [AuditService, PrismaService],
  exports: [AuditService],
})
export class GovernanceModule {}
