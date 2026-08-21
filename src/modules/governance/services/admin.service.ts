import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../config/prisma.service';
import { BusinessRuleException } from '../../../common/exceptions/business-rule.exception';
import { ErrorCode } from '../../../common/enums/error-codes.enum';
import { UUID } from '../../../common/types/uuid.type';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        full_name: true,
        is_active: true,
        mfa_enabled: true,
        created_at: true,
        user_roles: {
          include: {
            role: { select: { id: true, name: true } }
          }
        }
      },
      where: { deleted_at: null },
      orderBy: { created_at: 'desc' }
    });
  }

  async createUser(data: any) {
    const existingUser = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (existingUser) {
      throw new BusinessRuleException('Email already exists', ErrorCode.VALIDATION_ERROR);
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: data.email,
          full_name: data.full_name,
          password_hash: hashedPassword,
          is_active: data.is_active ?? true,
          branch_id: data.branch_id
        }
      });

      if (data.role_ids && data.role_ids.length > 0) {
        await tx.userRole.createMany({
          data: data.role_ids.map(roleId => ({
            user_id: user.id,
            role_id: roleId
          }))
        });
      }

      return user;
    });
  }

  async updateUser(userId: UUID, data: any) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BusinessRuleException('User not found', ErrorCode.NOT_FOUND);

    return this.prisma.$transaction(async (tx) => {
      if (data.role_ids) {
        await tx.userRole.deleteMany({ where: { user_id: userId } });
        if (data.role_ids.length > 0) {
          await tx.userRole.createMany({
            data: data.role_ids.map(roleId => ({
              user_id: userId,
              role_id: roleId
            }))
          });
        }
      }

      return tx.user.update({
        where: { id: userId },
        data: {
          full_name: data.full_name,
          is_active: data.is_active,
          branch_id: data.branch_id
        }
      });
    });
  }

  async resetPassword(userId: UUID) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BusinessRuleException('User not found', ErrorCode.NOT_FOUND);

    const tempPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password_hash: hashedPassword }
    });

    this.logger.log(`Password reset for user ${userId}. Temp password generated.`);
    return { temp_password: tempPassword };
  }

  async getRoles() {
    return this.prisma.role.findMany({
      include: {
        role_permissions: {
          include: { permission: true }
        },
        _count: { select: { user_roles: true } }
      },
      orderBy: { name: 'asc' }
    });
  }

  async createRole(data: any) {
    const existing = await this.prisma.role.findUnique({ where: { name: data.name } });
    if (existing) throw new BusinessRuleException('Role name exists', ErrorCode.VALIDATION_ERROR);

    return this.prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: {
          name: data.name,
          description: data.description,
          is_active: data.is_active ?? true
        }
      });

      if (data.permission_ids && data.permission_ids.length > 0) {
        await tx.rolePermission.createMany({
          data: data.permission_ids.map(permId => ({
            role_id: role.id,
            permission_id: permId
          }))
        });
      }

      return role;
    });
  }

  async updateRole(roleId: UUID, data: any) {
    return this.prisma.$transaction(async (tx) => {
      if (data.permission_ids) {
        await tx.rolePermission.deleteMany({ where: { role_id: roleId } });
        if (data.permission_ids.length > 0) {
          await tx.rolePermission.createMany({
            data: data.permission_ids.map(permId => ({
              role_id: roleId,
              permission_id: permId
            }))
          });
        }
      }

      return tx.role.update({
        where: { id: roleId },
        data: {
          name: data.name,
          description: data.description,
          is_active: data.is_active
        }
      });
    });
  }

  async getPermissions() {
    return this.prisma.permission.findMany({
      orderBy: [
        { module: 'asc' },
        { action: 'asc' }
      ]
    });
  }
}
