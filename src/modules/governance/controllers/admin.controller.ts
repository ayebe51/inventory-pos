import { Controller, Get, Post, Put, Body, Param, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody, ApiParam } from '@nestjs/swagger';
import { AdminService } from '../services/admin.service';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { RbacGuard } from '../../../common/guards/rbac.guard';
import { successResponse } from '../../../common/types/api-response.type';
import { UUID } from '../../../common/types/uuid.type';
import { CreateUserDTO, UpdateUserDTO, CreateRoleDTO, UpdateRoleDTO } from '../dto/admin.dto';

@ApiTags('Governance - Admin')
@ApiBearerAuth()
@Controller('api/v1/admin')
@UseGuards(AuthGuard('jwt'), RbacGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // --- Users ---

  @ApiOperation({ summary: 'Get all users' })
  @Get('users')
  @RequirePermissions('ADMIN.USER')
  async getUsers() {
    const users = await this.adminService.getUsers();
    return successResponse(users);
  }

  @ApiOperation({ summary: 'Create a new user' })
  @ApiBody({ type: CreateUserDTO })
  @Post('users')
  @RequirePermissions('ADMIN.USER')
  async createUser(@Body() body: CreateUserDTO) {
    const user = await this.adminService.createUser(body as any);
    return successResponse(user, 'User created successfully');
  }

  @ApiOperation({ summary: 'Update an existing user' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @ApiBody({ type: UpdateUserDTO })
  @Put('users/:id')
  @RequirePermissions('ADMIN.USER')
  async updateUser(@Param('id') id: UUID, @Body() body: UpdateUserDTO) {
    const user = await this.adminService.updateUser(id, body as any);
    return successResponse(user, 'User updated successfully');
  }

  @ApiOperation({ summary: 'Reset a user password' })
  @ApiParam({ name: 'id', description: 'User ID' })
  @Post('users/:id/reset-password')
  @RequirePermissions('ADMIN.USER')
  async resetPassword(@Param('id') id: UUID) {
    const result = await this.adminService.resetPassword(id);
    return successResponse(result, 'Password reset successfully');
  }

  // --- Roles ---

  @ApiOperation({ summary: 'Get all roles' })
  @Get('roles')
  @RequirePermissions('ADMIN.USER')
  async getRoles() {
    const roles = await this.adminService.getRoles();
    return successResponse(roles);
  }

  @ApiOperation({ summary: 'Create a new role' })
  @ApiBody({ type: CreateRoleDTO })
  @Post('roles')
  @RequirePermissions('ADMIN.USER')
  async createRole(@Body() body: CreateRoleDTO) {
    const role = await this.adminService.createRole(body as any);
    return successResponse(role, 'Role created successfully');
  }

  @ApiOperation({ summary: 'Update an existing role' })
  @ApiParam({ name: 'id', description: 'Role ID' })
  @ApiBody({ type: UpdateRoleDTO })
  @Put('roles/:id')
  @RequirePermissions('ADMIN.USER')
  async updateRole(@Param('id') id: UUID, @Body() body: UpdateRoleDTO) {
    const role = await this.adminService.updateRole(id, body as any);
    return successResponse(role, 'Role updated successfully');
  }

  // --- Permissions ---

  @ApiOperation({ summary: 'Get all permissions' })
  @Get('permissions')
  @RequirePermissions('ADMIN.USER')
  async getPermissions() {
    const permissions = await this.adminService.getPermissions();
    return successResponse(permissions);
  }
}
