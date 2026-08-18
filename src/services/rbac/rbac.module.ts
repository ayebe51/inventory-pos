import { Module, Global } from '@nestjs/common';
import { RbacService } from './rbac.service';
import { PrismaService } from '../../config/prisma.service';

@Global()
@Module({
  providers: [RbacService, PrismaService],
  exports: [RbacService],
})
export class RbacModule {}
