import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { OrganizationService } from '../services/organization.service';
import { successResponse } from '../../../common/types/api-response.type';
import { UUID } from '../../../common/types/uuid.type';
import { CreateHeadOfficeDTO, CreateBranchDTO } from '../dto/branch.dto';

interface AuthRequest extends Request {
  user: { sub: string };
}

@ApiTags('Master Data - Organization')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('api/v1/organization')
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  /**
   * POST /api/v1/organization/head-offices and /api/v1/organization/head-office
   * Create a Head Office node.
   */
  @ApiOperation({ summary: 'Create a Head Office node' })
  @ApiBody({ type: CreateHeadOfficeDTO })
  @Post(['head-offices', 'head-office'])
  @RequirePermissions('ADMIN.SETTINGS')
  async createHeadOffice(@Body() body: CreateHeadOfficeDTO, @Request() req: AuthRequest) {
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
  @ApiOperation({ summary: 'Create a Branch under a Head Office' })
  @ApiBody({ type: CreateBranchDTO })
  @Post('branches')
  @RequirePermissions('ADMIN.SETTINGS')
  async createBranch(@Body() body: CreateBranchDTO, @Request() req: AuthRequest) {
    const branch = await this.organizationService.createBranch(
      body as any,
      req.user.sub as UUID,
    );
    return successResponse(branch, 'Cabang berhasil dibuat');
  }

  /**
   * PUT /api/v1/organization/branches/:id
   * Update Branch or Head Office
   */
  @ApiOperation({ summary: 'Update branch or head office' })
  @ApiParam({ name: 'id', description: 'Branch ID' })
  @Put('branches/:id')
  @RequirePermissions('ADMIN.SETTINGS')
  async updateBranch(
    @Param('id') id: string,
    @Body() body: any,
    @Request() req: AuthRequest,
  ) {
    const branch = await this.organizationService.updateBranch(
      id as UUID,
      body,
      req.user.sub as UUID,
    );
    return successResponse(branch, 'Data cabang berhasil diperbarui');
  }

  /**
   * GET /api/v1/organization/branches
   * Return flat list of active branches.
   */
  @ApiOperation({ summary: 'Get list of all active branches' })
  @Get('branches')
  async listBranches() {
    const branches = await this.organizationService.listBranches();
    return successResponse(branches);
  }

  /**
   * GET /api/v1/organization/hierarchy
   * Return full hierarchy tree (or subtree if branchId query param provided).
   */
  @ApiOperation({ summary: 'Get organization hierarchy tree' })
  @ApiQuery({ name: 'branchId', required: false })
  @Get('hierarchy')
  async getHierarchy(@Query('branchId') branchId?: string) {
    const tree = await this.organizationService.getHierarchy(branchId as UUID | undefined);
    return successResponse(tree);
  }

  /**
   * GET /api/v1/organization/:id/children
   * Return direct children of a node.
   */
  @ApiOperation({ summary: 'Get direct children of an organization node' })
  @ApiParam({ name: 'id', description: 'Node ID' })
  @Get(':id/children')
  async getChildren(@Param('id') id: string) {
    const children = await this.organizationService.getChildren(id as UUID);
    return successResponse(children);
  }
}
