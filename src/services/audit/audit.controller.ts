import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuditService } from './audit.service';
import { AuditQuerySchema } from './dto/audit-query.dto';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { RbacGuard } from '../../common/guards/rbac.guard';
import { successResponse } from '../../common/types/api-response.type';

/**
 * GET /api/v1/audit-logs
 *
 * Query audit trail with optional filters and pagination.
 * Requires ADMIN.USER permission (Governance — Req 10 AC 3).
 */
@Controller('api/v1/audit-logs')
@UseGuards(AuthGuard('jwt'), RbacGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @RequirePermissions('ADMIN.USER')
  async query(@Query() rawQuery: Record<string, string>) {
    const filters = AuditQuerySchema.parse(rawQuery);
    const result = await this.auditService.query(filters);
    return successResponse(result.data, 'OK', result.meta);
  }
}
