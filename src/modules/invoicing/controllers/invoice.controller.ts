import {
  Body,
  Controller,
  Param,
  Post,
  Get,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { InvoiceService } from '../services/invoice.service';
import { successResponse } from '../../../common/types/api-response.type';
import { UUID } from '../../../common/types/uuid.type';
import { CreateSalesInvoiceDTO, CreatePurchaseInvoiceDTO } from '../dto/invoicing.dto';

interface AuthRequest extends Request {
  user: { sub: string };
}

@ApiTags('Invoicing - Invoices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('api/v1/invoices')
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

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

  @Get()
  @RequirePermissions('INVOICE.READ')
  async search(@Request() req: Request) {
    const query = (req as any).query;
    const filters = {
      invoice_type: query.invoice_type,
      status: query.status,
      customer_id: query.customer_id,
      supplier_id: query.supplier_id,
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
  async findById(@Param('id') id: string) {
    const invoice = await this.invoiceService.findById(id as UUID);
    if (!invoice) return { success: false, message: 'Not found', data: null };
    return successResponse(invoice);
  }
}
