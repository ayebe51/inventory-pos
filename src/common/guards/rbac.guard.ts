import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { RbacService } from '../../services/rbac/rbac.service';
import { ErrorCode } from '../enums/error-codes.enum';

/**
 * RBAC guard — enforces permission requirements declared via @RequirePermissions().
 *
 * Execution order (applied after JwtAuthGuard):
 *  1. Skip if route is @Public()
 *  2. Skip if no permissions metadata (open authenticated endpoint)
 *  3. Resolve userId from JWT payload (request.user.sub)
 *  4. Check that user holds ALL required permissions via RbacService
 *  5. Throw ForbiddenException if any permission is missing
 */
@Injectable()
export class RbacGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rbacService: RbacService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. Skip public routes
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // 2. Skip if no permissions declared
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredPermissions || requiredPermissions.length === 0) return true;

    // 3. Get userId from JWT payload
    const request = context.switchToHttp().getRequest<Request & { user?: { sub: string } }>();
    const userId = request.user?.sub;

    if (!userId) {
      throw new ForbiddenException({
        success: false,
        error: {
          code: ErrorCode.FORBIDDEN,
          message: 'Insufficient permissions',
        },
      });
    }

    // 4. Check all required permissions
    const hasAll = await this.rbacService.hasAllPermissions(userId, requiredPermissions);

    if (!hasAll) {
      throw new ForbiddenException({
        success: false,
        error: {
          code: ErrorCode.FORBIDDEN,
          message: 'Insufficient permissions',
        },
      });
    }

    return true;
  }
}
