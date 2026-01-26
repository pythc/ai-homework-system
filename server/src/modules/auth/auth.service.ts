import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomUUID } from 'crypto';
import * as xlsx from 'xlsx';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { AuthSessionEntity } from './entities/auth-session.entity';
import { AccountType, UserEntity, UserRole, UserStatus } from './entities/user.entity';
import { LoginRequestDto } from './dto/login.dto';
import { RegisterRequestDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(AuthSessionEntity)
    private readonly sessionRepo: Repository<AuthSessionEntity>,
  ) {}

  async login(
    dto: LoginRequestDto,
    meta: { ip?: string; userAgent?: string; deviceId?: string },
  ) {
    const user = await this.userRepo.findOne({
      where:
        dto.accountType === AccountType.EMAIL
          ? {
              schoolId: dto.schoolId,
              email: dto.account,
            }
          : {
              schoolId: dto.schoolId,
              accountType: dto.accountType,
              account: dto.account,
            },
    });
    if (!user) {
      throw new UnauthorizedException('账号或密码错误');
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('账号已禁用');
    }

    const isMatch = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('账号或密码错误');
    }

    const accessToken = this.signAccessToken(user);
    const sessionId = randomUUID();
    const refreshToken = this.signRefreshToken(user.id, sessionId);
    const refreshTokenHash = this.hashToken(refreshToken);
    const refreshTtlSeconds = this.getRefreshTtlSeconds();
    const expiresAt = new Date(Date.now() + refreshTtlSeconds * 1000);

    const session = this.sessionRepo.create({
      id: sessionId,
      userId: user.id,
      refreshTokenHash,
      deviceId: meta.deviceId,
      userAgent: meta.userAgent,
      ip: meta.ip,
      expiresAt,
    });
    await this.sessionRepo.save(session);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.getAccessTtlSeconds(),
      user,
    };
  }

  async register(dto: RegisterRequestDto) {
    const exists = await this.userRepo.findOne({
      where: {
        schoolId: dto.schoolId,
        accountType: dto.accountType,
        account: dto.account,
      },
    });
    if (exists) {
      throw new ConflictException('账号已存在');
    }
    if (dto.email) {
      const emailExists = await this.userRepo.findOne({
        where: {
          schoolId: dto.schoolId,
          email: dto.email,
        },
      });
      if (emailExists) {
        throw new ConflictException('邮箱已存在');
      }
    }

    const user = this.userRepo.create({
      id: randomUUID(),
      schoolId: dto.schoolId,
      accountType: dto.accountType,
      account: dto.account,
      email: dto.email ?? null,
      role: dto.role,
      status: dto.status ?? UserStatus.ACTIVE,
      name: dto.name ?? null,
      passwordHash: await this.hashPassword(dto.password),
    });
    const saved = await this.userRepo.save(user);
    return saved;
  }

  async registerBulkFromExcel(buffer: Buffer, schoolId: string) {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
    }) as Array<Array<unknown>>;

    const results = {
      total: Math.max(rows.length - 1, 0),
      created: 0,
      skipped: 0,
      errors: [] as Array<{ row: number; reason: string; account?: string }>,
    };

    const seenAccounts = new Set<string>();
    for (let i = 1; i < rows.length; i += 1) {
      const row = rows[i] ?? [];
      const rowNumber = i + 1;
      const name = String(row[1] ?? '').trim();
      const account = String(row[2] ?? '').trim();
      const email = String(row[3] ?? '').trim();
      const roleRaw = String(row[4] ?? '').trim();

      if (!name || !account || !roleRaw) {
        results.skipped += 1;
        results.errors.push({
          row: rowNumber,
          reason: '姓名/学号(工号)/身份不能为空',
          account: account || undefined,
        });
        continue;
      }

      if (seenAccounts.has(account)) {
        results.skipped += 1;
        results.errors.push({
          row: rowNumber,
          reason: '表内学号/工号重复',
          account,
        });
        continue;
      }
      seenAccounts.add(account);

      let role: UserRole | null = null;
      if (roleRaw === '学生') {
        role = UserRole.STUDENT;
      } else if (roleRaw === '教师') {
        role = UserRole.TEACHER;
      }

      if (!role) {
        results.skipped += 1;
        results.errors.push({
          row: rowNumber,
          reason: '身份仅支持学生/教师',
          account,
        });
        continue;
      }

      const accountType =
        role === UserRole.STUDENT
          ? AccountType.STUDENT_ID
          : AccountType.USERNAME;

      const exists = await this.userRepo.findOne({
        where: { schoolId, account },
      });
      if (exists) {
        results.skipped += 1;
        results.errors.push({
          row: rowNumber,
          reason: '账号已存在',
          account,
        });
        continue;
      }

      if (email) {
        const emailExists = await this.userRepo.findOne({
          where: { schoolId, email },
        });
        if (emailExists) {
          results.skipped += 1;
          results.errors.push({
            row: rowNumber,
            reason: '邮箱已存在',
            account,
          });
          continue;
        }
      }

      const user = this.userRepo.create({
        id: randomUUID(),
        schoolId,
        accountType,
        account,
        email: email || null,
        role,
        status: UserStatus.ACTIVE,
        name,
        passwordHash: await this.hashPassword(`cqupt${account}`),
      });
      await this.userRepo.save(user);
      results.created += 1;
    }

    return results;
  }

  async refresh(
    refreshToken: string,
    meta: { ip?: string; userAgent?: string },
  ) {
    const payload = this.verifyRefreshToken(refreshToken);
    const refreshTokenHash = this.hashToken(refreshToken);
    const session = await this.sessionRepo.findOne({
      where: { id: payload.sid },
    });
    if (!session || session.revokedAt) {
      throw new UnauthorizedException('刷新令牌无效');
    }
    if (session.refreshTokenHash !== refreshTokenHash) {
      throw new UnauthorizedException('刷新令牌已失效');
    }
    if (session.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('刷新令牌已过期');
    }

    const user = await this.userRepo.findOne({
      where: { id: session.userId },
    });
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new ForbiddenException('账号已禁用');
    }

    const newRefreshToken = this.signRefreshToken(user.id, session.id);
    session.refreshTokenHash = this.hashToken(newRefreshToken);
    session.updatedAt = new Date();
    session.expiresAt = new Date(
      Date.now() + this.getRefreshTtlSeconds() * 1000,
    );
    session.ip = meta.ip ?? session.ip;
    session.userAgent = meta.userAgent ?? session.userAgent;
    await this.sessionRepo.save(session);

    return {
      accessToken: this.signAccessToken(user),
      refreshToken: newRefreshToken,
      expiresIn: this.getAccessTtlSeconds(),
      user,
    };
  }

  async logout(refreshToken: string): Promise<void> {
    let payload: { sub: string; sid: string } | null = null;
    try {
      payload = this.verifyRefreshToken(refreshToken);
    } catch (error) {
      return;
    }
    const refreshTokenHash = this.hashToken(refreshToken);
    const session = await this.sessionRepo.findOne({
      where: { id: payload.sid },
    });
    if (!session) {
      return;
    }
    if (session.refreshTokenHash !== refreshTokenHash) {
      return;
    }
    session.revokedAt = new Date();
    session.updatedAt = new Date();
    await this.sessionRepo.save(session);
  }

  async getUserById(userId: string): Promise<UserEntity | null> {
    return this.userRepo.findOne({ where: { id: userId } });
  }

  verifyAccessToken(token: string): {
    sub: string;
    role: UserRole;
    schoolId: string;
  } {
    try {
      return jwt.verify(token, this.getAccessSecret()) as {
        sub: string;
        role: UserRole;
        schoolId: string;
      };
    } catch (error) {
      this.logger.warn('Access token verification failed.');
      throw new UnauthorizedException('无效的访问令牌');
    }
  }

  private signAccessToken(user: UserEntity): string {
    const payload = {
      sub: user.id,
      role: user.role,
      schoolId: user.schoolId,
    };
    return jwt.sign(payload, this.getAccessSecret(), {
      expiresIn: this.getAccessTtlSeconds(),
    });
  }

  private signRefreshToken(userId: string, sessionId: string): string {
    const payload = {
      sub: userId,
      sid: sessionId,
    };
    return jwt.sign(payload, this.getRefreshSecret(), {
      expiresIn: this.getRefreshTtlSeconds(),
    });
  }

  private verifyRefreshToken(token: string): { sub: string; sid: string } {
    try {
      return jwt.verify(token, this.getRefreshSecret()) as {
        sub: string;
        sid: string;
      };
    } catch (error) {
      throw new UnauthorizedException('刷新令牌无效');
    }
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private getAccessSecret(): string {
    return process.env.JWT_ACCESS_SECRET || 'dev_access_secret';
  }

  private getRefreshSecret(): string {
    return process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret';
  }

  private getAccessTtlSeconds(): number {
    return Number(process.env.JWT_ACCESS_TTL_SECONDS || 7200);
  }

  private getRefreshTtlSeconds(): number {
    return Number(process.env.JWT_REFRESH_TTL_SECONDS || 2592000);
  }

  async hashPassword(password: string): Promise<string> {
    const rounds = Number(process.env.BCRYPT_ROUNDS || 12);
    return bcrypt.hash(password, rounds);
  }
}
