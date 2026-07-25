import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { BankReconciliationService } from '../services/bank-reconciliation.service';
import { successResponse } from '../../../common/types/api-response.type';
import { UUID } from '../../../common/types/uuid.type';

interface AuthRequest extends Request {
  user: { sub: string };
}

@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('api/v1/bank-reconciliation')
export class BankReconciliationController {
  constructor(private readonly reconService: BankReconciliationService) {}

  @Post('upload')
  @RequirePermissions('ACCOUNTING.UPDATE')
  @UseInterceptors(FileInterceptor('file'))
  async uploadStatement(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new Error('File is required');
    }

    const csvContent = file.buffer.toString('utf-8');
    const rows = this.reconService.parseStatement(csvContent);
    const matches = await this.reconService.autoMatch(rows);

    return successResponse(matches, 'Statement parsed and matched successfully');
  }

  @Post('confirm')
  @RequirePermissions('ACCOUNTING.UPDATE')
  async confirmReconciliation(@Body() body: { payment_ids: string[] }, @Request() req: AuthRequest) {
    if (!body.payment_ids || body.payment_ids.length === 0) {
      throw new Error('No payments selected for confirmation');
    }

    await this.reconService.confirmReconciliation(body.payment_ids as UUID[], req.user.sub as UUID);
    
    return successResponse(null, 'Reconciliation confirmed successfully');
  }
}
