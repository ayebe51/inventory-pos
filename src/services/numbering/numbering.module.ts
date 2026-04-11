import { Module } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { NumberingService } from './numbering.service';

@Module({
  providers: [NumberingService, PrismaService],
  exports: [NumberingService],
})
export class NumberingModule {}
