import { Module, Global } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { PrismaService } from '../../config/prisma.service';

@Global()
@Module({
  providers: [AuditService, PrismaService],
  controllers: [AuditController],
  exports: [AuditService],
})
export class AuditModule {}
