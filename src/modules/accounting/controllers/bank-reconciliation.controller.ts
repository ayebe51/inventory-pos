import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { BankReconciliationService } from '../services/bank-reconciliation.service';
import { PrismaService } from '../../../config/prisma.service';
import { successResponse } from '../../../common/types/api-response.type';
import { UUID } from '../../../common/types/uuid.type';
import { UploadBankStatementDTO, ConfirmReconciliationDTO } from '../dto/accounting.dto';

interface AuthRequest extends Request {
  user: { sub: string };
}

@ApiTags('Accounting - Bank Reconciliation')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('api/v1/bank-reconciliation')
export class BankReconciliationController {
  constructor(
    private readonly reconService: BankReconciliationService,
    private readonly prisma: PrismaService,
  ) {}

  @ApiOperation({ summary: 'Upload bank statement and auto-match' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadBankStatementDTO })
  @Post('upload')
  @RequirePermissions('ACCOUNTING.UPDATE')
  @UseInterceptors(FileInterceptor('file'))
  async uploadStatement(
    @UploadedFile() file: any,
    @Body('bank_account_id') bankAccountId: string,
    @Body('from_date') fromDate: string,
    @Body('to_date') toDate: string
  ) {
    if (!file) throw new Error('File is required');
    let targetAccountId = bankAccountId;
    if (!targetAccountId) {
      const defaultBank = await this.prisma.chartOfAccount.findFirst({
        where: {
          account_type: 'ASSET',
          OR: [
            { account_code: { startsWith: '1.101.002' } },
            { account_code: { startsWith: '1.101' } },
            { account_code: { startsWith: '1002' } },
            { account_name: { contains: 'Bank', mode: 'insensitive' } },
          ],
        },
      });
      if (!defaultBank) {
        throw new Error('bank_account_id is required and no default bank account was found');
      }
      targetAccountId = defaultBank.id;
    }

    const csvContent = file.buffer.toString('utf-8');
    await this.reconService.uploadStatement(targetAccountId as UUID, csvContent);
    const matches = await this.reconService.autoMatch(
       targetAccountId as UUID, 
       fromDate ? new Date(fromDate) : new Date(0), 
       toDate ? new Date(toDate) : new Date()
    );

    return successResponse(matches, 'Statement parsed and matched successfully');
  }

  @ApiOperation({ summary: 'Confirm reconciliation matches' })
  @ApiBody({ type: ConfirmReconciliationDTO })
  @Post('confirm')
  @RequirePermissions('ACCOUNTING.UPDATE')
  async confirmReconciliation(@Body() body: any, @Request() req: AuthRequest) {
    const rawMatches = body.matches || (body.payment_ids ? body.payment_ids.map((id: string) => ({ payment_id: id })) : []);
    if (!rawMatches || rawMatches.length === 0) {
      throw new Error('No matches selected for confirmation');
    }

    await this.reconService.confirmReconciliation(rawMatches as any, req.user.sub as UUID);
    
    return successResponse(null, 'Reconciliation confirmed successfully');
  }
}
