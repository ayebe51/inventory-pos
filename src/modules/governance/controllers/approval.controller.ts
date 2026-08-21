import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { paginatedResponse, successResponse } from '../../../common/types/api-response.type';
import { UUID } from '../../../common/types/uuid.type';
import { PrismaService } from '../../../config/prisma.service';
import { ApproveRequestDTO, RejectRequestDTO } from '../dto/approval.dto';

interface AuthRequest extends Request {
  user: { sub: string };
}

/**
 * Approval Controller
 * Handles approval requests for PO, Payment, etc.
 */
@ApiTags('Governance - Approvals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('api/v1/approvals')
export class ApprovalController {
  constructor(private readonly prisma: PrismaService) {}

  @ApiOperation({ summary: 'List pending approvals for the current user' })
  @ApiQuery({ name: 'document_type', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @Get('pending')
  @RequirePermissions('PURCHASE.APPROVE')
  async listPending(
    @Request() req: AuthRequest,
    @Query() query: { document_type?: string; page?: number },
  ) {
    const page = query.page ? Number(query.page) : 1;
    const per_page = 20;
    const skip = (page - 1) * per_page;

    const where: any = {
      status: 'PENDING',
      steps: {
        some: {
          approver_id: req.user.sub,
          status: 'PENDING',
        },
      },
    };

    if (query.document_type) {
      where.document_type = query.document_type;
    }

    const [data, total] = await this.prisma.$transaction([
      this.prisma.approvalRequest.findMany({
        where,
        skip,
        take: per_page,
        orderBy: { created_at: 'desc' },
        include: {
          steps: true,
        },
      }),
      this.prisma.approvalRequest.count({ where }),
    ]);

    return paginatedResponse(data, total, page, per_page);
  }

  @ApiOperation({ summary: 'Approve a request' })
  @ApiParam({ name: 'id', description: 'Approval Request ID' })
  @ApiBody({ type: ApproveRequestDTO })
  @Post(':id/approve')
  @RequirePermissions('PURCHASE.APPROVE')
  async approve(
    @Param('id') id: string,
    @Body() body: ApproveRequestDTO,
    @Request() req: AuthRequest,
  ) {
    const request = await this.prisma.approvalRequest.findUnique({
      where: { id },
      include: { steps: true },
    });

    if (!request) throw new Error('Approval request not found');

    const step = request.steps.find(
      (s: any) => s.approver_id === req.user.sub && s.status === 'PENDING',
    );

    if (!step) throw new Error('You are not authorized to approve this request');

    // Update step
    await this.prisma.approvalRequestStep.update({
      where: { id: step.id },
      data: {
        status: 'APPROVED',
        decision_at: new Date(),
        notes: body.notes,
      },
    });

    // Check if all steps approved
    const allApproved = request.steps.every(
      (s: any) => s.id === step.id || s.status === 'APPROVED',
    );

    if (allApproved) {
      await this.prisma.approvalRequest.update({
        where: { id },
        data: { status: 'APPROVED' },
      });
    }

    return successResponse({ id, status: 'APPROVED' }, 'Approval recorded');
  }

  @ApiOperation({ summary: 'Reject a request' })
  @ApiParam({ name: 'id', description: 'Approval Request ID' })
  @ApiBody({ type: RejectRequestDTO })
  @Post(':id/reject')
  @RequirePermissions('PURCHASE.APPROVE')
  async reject(
    @Param('id') id: string,
    @Body() body: RejectRequestDTO,
    @Request() req: AuthRequest,
  ) {
    if (!body.reason) throw new Error('Rejection reason is required');

    await this.prisma.approvalRequest.update({
      where: { id },
      data: { status: 'REJECTED' },
    });

    await this.prisma.approvalRequestStep.updateMany({
      where: { request_id: id, approver_id: req.user.sub },
      data: { status: 'REJECTED', notes: body.reason, decision_at: new Date() },
    });

    return successResponse({ id, status: 'REJECTED' }, 'Request rejected');
  }

  @ApiOperation({ summary: 'List approval history for the current user' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @Get('history')
  @RequirePermissions('PURCHASE.APPROVE') // Should be a general view permission, using this for simplicity
  async listHistory(
    @Request() req: AuthRequest,
    @Query() query: { page?: number },
  ) {
    const page = query.page ? Number(query.page) : 1;
    const per_page = 20;
    const skip = (page - 1) * per_page;

    const where: any = {
      steps: {
        some: {
          approver_id: req.user.sub,
          status: { in: ['APPROVED', 'REJECTED'] },
        },
      },
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.approvalRequest.findMany({
        where,
        skip,
        take: per_page,
        orderBy: { updated_at: 'desc' },
        include: { steps: true },
      }),
      this.prisma.approvalRequest.count({ where }),
    ]);

    return paginatedResponse(data, total, page, per_page);
  }
}
