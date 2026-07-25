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
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { paginatedResponse, successResponse } from '../../../common/types/api-response.type';
import { UUID } from '../../../common/types/uuid.type';
import { PrismaService } from '../../../prisma/prisma.service';

interface AuthRequest extends Request {
  user: { sub: string };
}

/**
 * Approval Controller
 * Handles approval requests for PO, Payment, etc.
 *
 * GET  /api/v1/approvals/pending   — List pending approvals for current user
 * POST /api/v1/approvals/:id/approve
 * POST /api/v1/approvals/:id/reject
 */
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('api/v1/approvals')
export class ApprovalController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('pending')
  @RequirePermissions('PURCHASE.APPROVE')
  async listPending(
    @Request() req: AuthRequest,
    @Query() query: { document_type?: string; page?: number },
  ) {
    const page = query.page || 1;
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
      this.prisma.approval_requests.findMany({
        where,
        skip,
        take: per_page,
        orderBy: { created_at: 'desc' },
        include: {
          steps: true,
        },
      }),
      this.prisma.approval_requests.count({ where }),
    ]);

    return paginatedResponse(data, total, page, per_page);
  }

  @Post(':id/approve')
  @RequirePermissions('PURCHASE.APPROVE')
  async approve(
    @Param('id') id: string,
    @Body() body: { notes?: string },
    @Request() req: AuthRequest,
  ) {
    const request = await this.prisma.approval_requests.findUnique({
      where: { id },
      include: { steps: true },
    });

    if (!request) throw new Error('Approval request not found');

    const step = request.steps.find(
      (s: any) => s.approver_id === req.user.sub && s.status === 'PENDING',
    );

    if (!step) throw new Error('You are not authorized to approve this request');

    // Update step
    await this.prisma.approval_request_steps.update({
      where: { id: step.id },
      data: {
        status: 'APPROVED',
        decided_at: new Date(),
        notes: body.notes,
      },
    });

    // Check if all steps approved
    const allApproved = request.steps.every(
      (s: any) => s.id === step.id || s.status === 'APPROVED',
    );

    if (allApproved) {
      await this.prisma.approval_requests.update({
        where: { id },
        data: { status: 'APPROVED' },
      });
    }

    return successResponse({ id, status: 'APPROVED' }, 'Approval recorded');
  }

  @Post(':id/reject')
  @RequirePermissions('PURCHASE.APPROVE')
  async reject(
    @Param('id') id: string,
    @Body() body: { reason: string },
    @Request() req: AuthRequest,
  ) {
    if (!body.reason) throw new Error('Rejection reason is required');

    await this.prisma.approval_requests.update({
      where: { id },
      data: { status: 'REJECTED' },
    });

    await this.prisma.approval_request_steps.updateMany({
      where: { approval_request_id: id, approver_id: req.user.sub },
      data: { status: 'REJECTED', notes: body.reason, decided_at: new Date() },
    });

    return successResponse({ id, status: 'REJECTED' }, 'Request rejected');
  }
}
