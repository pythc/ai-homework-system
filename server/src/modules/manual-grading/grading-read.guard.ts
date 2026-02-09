import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { UserRole } from '../auth/entities/user.entity';
import { SubmissionVersionEntity } from '../submission/entities/submission-version.entity';

type ReadScope = 'TEACHER' | 'ANY' | 'PUBLIC';

@Injectable()
export class ManualGradingReadGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    @InjectRepository(SubmissionVersionEntity)
    private readonly submissionVersionRepo: Repository<SubmissionVersionEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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

    if (payload.role === UserRole.STUDENT) {
      const submissionVersionId = String(request.params?.submissionVersionId ?? '').trim();
      if (!submissionVersionId || submissionVersionId === 'undefined') {
        throw new ForbiddenException('权限不足');
      }
      const version = await this.submissionVersionRepo.findOne({
        where: { id: submissionVersionId },
      });
      if (!version) {
        throw new ForbiddenException('权限不足');
      }
      if (version.studentId !== payload.sub) {
        throw new ForbiddenException('权限不足');
      }
      return true;
    }

    throw new ForbiddenException('权限不足');
  }
}
