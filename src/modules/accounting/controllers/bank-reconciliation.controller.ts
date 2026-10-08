import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  ParseFilePipeBuilder,
  HttpStatus,
  BadRequestException,
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

export interface UploadedStatementFile {
  originalname: string;
  mimetype: string;
  size?: number;
  buffer: Buffer;
}

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
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({ maxSize: 5 * 1024 * 1024 }) // 5 MB limit
        .build({
          errorHttpStatusCode: HttpStatus.BAD_REQUEST,
          fileIsRequired: true,
        }),
    )
    file: UploadedStatementFile,
    @Body('bank_account_id') bankAccountId?: string,
    @Body('from_date') fromDate?: string,
    @Body('to_date') toDate?: string,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    // 1. Extension validation (reject non-.csv)
    const originalName = (file.originalname || '').toLowerCase();
    if (!originalName.endsWith('.csv')) {
      throw new BadRequestException('Invalid file extension: only .csv files are supported');
    }

    // 2. MIME type validation
    const allowedMimes = [
      'text/csv',
      'text/plain',
      'application/vnd.ms-excel',
      'application/csv',
      'text/x-csv',
      'application/x-csv',
      'text/comma-separated-values',
    ];
    if (file.mimetype && !allowedMimes.includes(file.mimetype.toLowerCase())) {
      throw new BadRequestException(`Invalid file MIME type (${file.mimetype}): only CSV files are accepted`);
    }

    // 3. Empty buffer validation
    if (!file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('Uploaded file is empty');
    }

    // 4. Binary payload / null-byte detection (reject binary payloads disguised as CSV)
    const previewLength = Math.min(file.buffer.length, 2048);
    for (let i = 0; i < previewLength; i++) {
      if (file.buffer[i] === 0x00) {
        throw new BadRequestException('Invalid file content: binary payload detected');
      }
    }

    const csvContent = file.buffer.toString('utf-8');
    if (!csvContent.trim()) {
      throw new BadRequestException('Uploaded file is empty');
    }

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
        throw new BadRequestException('bank_account_id is required and no default bank account was found');
      }
      targetAccountId = defaultBank.id;
    }

    await this.reconService.uploadStatement(targetAccountId as UUID, csvContent);
    const matches = await this.reconService.autoMatch(
      targetAccountId as UUID,
      fromDate ? new Date(fromDate) : new Date(0),
      toDate ? new Date(toDate) : new Date(),
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
      throw new BadRequestException('No matches selected for confirmation');
    }

    await this.reconService.confirmReconciliation(rawMatches as any, req.user.sub as UUID);

    return successResponse(null, 'Reconciliation confirmed successfully');
  }
}
