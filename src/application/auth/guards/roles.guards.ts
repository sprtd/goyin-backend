import { RoleNameType } from '@/interfaces/types/users/roles.type';
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<RoleNameType[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    console.log('🚀 ~ RolesGuard ~ canActivate ~ user:', user);

    if (!user || !user.role || !user.role.name) {
      throw new UnauthorizedException('User role is not defined');
    }

    const hasRole = requiredRoles.includes(user.role.name);
    if (!hasRole) {
      throw new UnauthorizedException(
        `User role ${user.role} is not authorized to perform this action`,
      );
    }

    return hasRole;
  }
}
