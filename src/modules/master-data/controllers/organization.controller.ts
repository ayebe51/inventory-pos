import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { OrganizationService } from '../services/organization.service';
import { successResponse } from '../../../common/types/api-response.type';
import { UUID } from '../../../common/types/uuid.type';

interface AuthRequest extends Request {
  user: { sub: string };
}

@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('api/v1/organization')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  /**
   * POST /api/v1/organization/head-offices
   * Create a Head Office node.
   */
  @Post('head-offices')
  @RequirePermissions('ADMIN.SETTINGS')
  async createHeadOffice(@Body() body: unknown, @Request() req: AuthRequest) {
    const branch = await this.organizationService.createHeadOffice(
      body as any,
      req.user.sub as UUID,
    );
    return successResponse(branch, 'Head Office berhasil dibuat');
  }

  /**
   * POST /api/v1/organization/branches
   * Create a Branch under a Head Office.
   */
  @Post('branches')
  @RequirePermissions('ADMIN.SETTINGS')
  async createBranch(@Body() body: unknown, @Request() req: AuthRequest) {
    const branch = await this.organizationService.createBranch(
      body as any,
      req.user.sub as UUID,
    );
    return successResponse(branch, 'Cabang berhasil dibuat');
  }

  /**
   * GET /api/v1/organization/hierarchy
   * Return full hierarchy tree (or subtree if branchId query param provided).
   */
  @Get('hierarchy')
  async getHierarchy(@Query('branchId') branchId?: string) {
    const tree = await this.organizationService.getHierarchy(branchId as UUID | undefined);
    return successResponse(tree);
  }

  /**
   * GET /api/v1/organization/:id/children
   * Return direct children of a node.
   */
  @Get(':id/children')
  async getChildren(@Param('id') id: string) {
    const children = await this.organizationService.getChildren(id as UUID);
    return successResponse(children);
  }
}
