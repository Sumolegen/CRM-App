import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';
import { WorkspaceRole } from '../enums/workspace-role.enum';

@Injectable()
export class WorkspacePermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const membership = request.membership;

    if (!membership || !membership.role) {
      throw new ForbiddenException('Workspace context not found');
    }

    const role = membership.role;

    if (role.type === WorkspaceRole.OWNER || role.type === WorkspaceRole.ADMIN) {
      return true; // Owner and Admin have all permissions implicitly
    }

    const userPermissions = role.permissions || [];
    const hasPermission = requiredPermissions.every((permission) =>
      userPermissions.includes(permission)
    );

    if (!hasPermission) {
      throw new ForbiddenException('Insufficient workspace permissions');
    }

    return true;
  }
}
