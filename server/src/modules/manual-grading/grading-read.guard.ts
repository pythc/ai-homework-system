import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { UserRole } from '../auth/entities/user.entity';

type ReadScope = 'TEACHER' | 'ANY' | 'PUBLIC';

@Injectable()
export class ManualGradingReadGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const scope = (process.env.MANUAL_GRADING_GET_SCOPE || 'TEACHER')
      .toUpperCase() as ReadScope;
    if (scope === 'PUBLIC') {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers?.authorization as string | undefined;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('缺少访问令牌');
    }

    const token = authHeader.slice(7);
    const payload = this.authService.verifyAccessToken(token);
    request.user = payload;

    if (scope === 'ANY') {
      return true;
    }

    if (payload.role === UserRole.TEACHER || payload.role === UserRole.ADMIN) {
      return true;
    }

    throw new ForbiddenException('权限不足');
  }
}
