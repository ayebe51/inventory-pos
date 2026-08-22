import {
  Body,
  Controller,
  Param,
  Post,
  Get,
  Request,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { InvoiceService } from '../services/invoice.service';
import { CreditNoteService } from '../services/credit-note.service';
import { DebitNoteService } from '../services/debit-note.service';
import { successResponse } from '../../../common/types/api-response.type';
import { UUID } from '../../../common/types/uuid.type';
import { CreateSalesInvoiceDTO, CreatePurchaseInvoiceDTO } from '../dto/invoicing.dto';

interface AuthRequest extends Request {
  user: { sub: string; branch_id?: string | null };
}

@ApiTags('Invoicing - Invoices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('api/v1/invoices')
export class InvoiceController {
  constructor(
    private readonly invoiceService: InvoiceService,
    private readonly creditNoteService: CreditNoteService,
    private readonly debitNoteService: DebitNoteService,
  ) {}

  @ApiOperation({ summary: 'Create a new sales invoice' })
  @ApiBody({ type: CreateSalesInvoiceDTO })
  @Post('sales')
  @RequirePermissions('INVOICE.CREATE')
  async createSalesInvoice(@Body() body: CreateSalesInvoiceDTO, @Request() req: AuthRequest) {
    const invoice = await this.invoiceService.createSalesInvoice(body as any, req.user.sub as UUID);
    return successResponse(invoice, 'Sales Invoice created successfully');
  }

  @ApiOperation({ summary: 'Create a new purchase invoice' })
  @ApiBody({ type: CreatePurchaseInvoiceDTO })
  @Post('purchase')
  @RequirePermissions('INVOICE.CREATE')
  async createPurchaseInvoice(@Body() body: CreatePurchaseInvoiceDTO, @Request() req: AuthRequest) {
    const invoice = await this.invoiceService.createPurchaseInvoice(body as any, req.user.sub as UUID);
    return successResponse(invoice, 'Purchase Invoice created successfully');
  }

  @ApiOperation({ summary: 'Post an invoice' })
  @ApiParam({ name: 'id', description: 'Invoice ID' })
  @Post(':id/post')
  @RequirePermissions('INVOICE.POST')
  async post(@Param('id') id: string, @Request() req: AuthRequest) {
    const invoice = await this.invoiceService.post(id as UUID, req.user.sub as UUID);
    return successResponse(invoice, 'Invoice posted successfully');
  }

  @ApiOperation({ summary: 'Write off an invoice' })
  @ApiParam({ name: 'id', description: 'Invoice ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', example: 'Customer bankrupt' }
      }
    }
  })
  @Post(':id/write-off')
  @RequirePermissions('INVOICE.WRITE_OFF')
  async writeOff(@Param('id') id: string, @Body('reason') reason: string, @Request() req: AuthRequest) {
    const invoice = await this.invoiceService.writeOff(id as UUID, req.user.sub as UUID, reason);
    return successResponse(invoice, 'Invoice written off successfully');
  }

  @ApiOperation({ summary: 'Dispute an invoice' })
  @ApiParam({ name: 'id', description: 'Invoice ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', example: 'Incorrect amount' }
      }
    }
  })
  @Post(':id/dispute')
  @RequirePermissions('INVOICE.UPDATE')
  async dispute(@Param('id') id: string, @Body('reason') reason: string, @Request() req: AuthRequest) {
    const invoice = await this.invoiceService.dispute(id as UUID, reason, req.user.sub as UUID);
    return successResponse(invoice, 'Invoice status set to disputed');
  }

  @ApiOperation({ summary: 'Create a Credit Note for a Sales Invoice' })
  @ApiParam({ name: 'id', description: 'Sales Invoice ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        amount: { type: 'number', example: 500000 },
        reason: { type: 'string', example: 'Damaged item credit adjustment' }
      },
      required: ['amount', 'reason']
    }
  })
  @Post(':id/credit-note')
  @RequirePermissions('INVOICE.CREATE')
  async createCreditNote(
    @Param('id') id: string,
    @Body('amount') amount: number,
    @Body('reason') reason: string,
    @Request() req: AuthRequest,
  ) {
    const cn = await this.creditNoteService.createCreditNote(
      id as UUID,
      Number(amount),
      reason,
      req.user.sub as UUID,
    );
    return successResponse(cn, 'Credit Note created successfully');
  }

  @ApiOperation({ summary: 'Create a Debit Note for a Purchase Invoice' })
  @ApiParam({ name: 'id', description: 'Purchase Invoice ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        amount: { type: 'number', example: 300000 },
        reason: { type: 'string', example: 'Supplier overcharge debit adjustment' }
      },
      required: ['amount', 'reason']
    }
  })
  @Post(':id/debit-note')
  @RequirePermissions('INVOICE.CREATE')
  async createDebitNote(
    @Param('id') id: string,
    @Body('amount') amount: number,
    @Body('reason') reason: string,
    @Request() req: AuthRequest,
  ) {
    const dn = await this.debitNoteService.createDebitNote(
      id as UUID,
      Number(amount),
      reason,
      req.user.sub as UUID,
    );
    return successResponse(dn, 'Debit Note created successfully');
  }

  @Get()
  @RequirePermissions('INVOICE.READ')
  async search(@Request() req: AuthRequest) {
    const query = (req as any).query;
    const filters = {
      invoice_type: query.invoice_type,
      status: query.status,
      customer_id: query.customer_id,
      supplier_id: query.supplier_id,
      branch_id: req.user.branch_id,
      page: query.page ? parseInt(query.page) : 1,
      per_page: query.per_page ? parseInt(query.per_page) : 20,
    };
    const result = await this.invoiceService.search(filters);
    return {
      success: true,
      data: result.data,
      meta: result.meta,
      message: 'OK',
    };
  }

  @Get(':id')
  @RequirePermissions('INVOICE.READ')
  async findById(@Param('id') id: string, @Request() req: AuthRequest) {
    const invoice = await this.invoiceService.findById(id as UUID, req.user);
    if (!invoice) {
      throw new NotFoundException(`Invoice ${id} not found`);
    }
    return successResponse(invoice);
  }
}
