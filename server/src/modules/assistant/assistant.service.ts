import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { AssistantChatDto } from './dto/assistant-chat.dto';
import { AssistantStatsDto } from './dto/assistant-stats.dto';
import { ScoreEntity } from '../manual-grading/entities/score.entity';
import { SubmissionVersionEntity } from '../submission/entities/submission-version.entity';
import { AssignmentEntity } from '../assignment/entities/assignment.entity';
import { CourseEntity } from '../assignment/entities/course.entity';
import { UserEntity, UserRole } from '../auth/entities/user.entity';
import { AssistantClient } from './assistant.client';
import { AssistantTokenUsageEntity } from './entities/assistant-token-usage.entity';
import type { Response } from 'express';
import { TextDecoder } from 'util';

interface AssistantUserPayload {
  sub?: string;
  role?: UserRole;
  schoolId?: string;
}

@Injectable()
export class AssistantService {
  constructor(
    @InjectRepository(ScoreEntity)
    private readonly scoreRepo: Repository<ScoreEntity>,
    @InjectRepository(SubmissionVersionEntity)
    private readonly versionRepo: Repository<SubmissionVersionEntity>,
    @InjectRepository(AssignmentEntity)
    private readonly assignmentRepo: Repository<AssignmentEntity>,
    @InjectRepository(CourseEntity)
    private readonly courseRepo: Repository<CourseEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(AssistantTokenUsageEntity)
    private readonly usageRepo: Repository<AssistantTokenUsageEntity>,
    private readonly assistantClient: AssistantClient,
  ) {}

  async chat(dto: AssistantChatDto, user: AssistantUserPayload) {
    const stats = await this.getStats(dto, user);
    const quota = await this.getUsageSummary(user);
    if (!quota.allowed) {
      return {
        answer:
          '非常抱歉，小小作坊资金有限，长对话暂不支持，请开启新对话继续学习吧~',
        scope: stats.scope,
        stats: stats.stats,
      };
    }

    const response = await this.assistantClient.answer(
      dto.question,
      stats.stats,
      stats.scope,
      dto.sessionId,
      dto.thinking,
      dto.images,
    );
    await this.recordUsage(user, response?.usage, this.estimateTokens(dto.question));
    return response;
  }

  async chatStream(dto: AssistantChatDto, user: AssistantUserPayload, res: Response) {
    const stats = await this.getStats(dto, user);
    const quota = await this.getUsageSummary(user);

    if (!quota.allowed) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      if (typeof (res as any).flushHeaders === 'function') {
        (res as any).flushHeaders();
      }
      res.write(`event: ready\ndata: {}\n\n`);
      res.write(
        `event: done\ndata: ${JSON.stringify({
          answer:
            '非常抱歉，小小作坊资金有限，长对话暂不支持，请开启新对话继续学习吧~',
          scope: stats.scope,
          stats: stats.stats,
        })}\n\n`,
      );
      res.end();
      return;
    }

    const stream = await this.assistantClient.answerStream(
      dto.question,
      stats.stats,
      stats.scope,
      dto.sessionId,
      dto.thinking,
      dto.images,
    );
    if (!stream) {
      res.end();
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    if (typeof (res as any).flushHeaders === 'function') {
      (res as any).flushHeaders();
    }

    try {
      const reader = (stream as any).getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let usagePayload: Record<string, unknown> | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          res.write(Buffer.from(value));
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() ?? '';
          for (const part of parts) {
            const lines = part.split('\n');
            let event = 'message';
            const dataLines: string[] = [];
            for (const line of lines) {
              if (line.startsWith('event:')) {
                event = line.slice(6).trim();
              } else if (line.startsWith('data:')) {
                dataLines.push(line.slice(5).trim());
              }
            }
            if (event !== 'done') continue;
            const data = dataLines.join('\n');
            if (!data) continue;
            try {
              const payload = JSON.parse(data);
              if (payload?.usage) {
                usagePayload = payload.usage;
              }
            } catch {
              // ignore
            }
          }
        }
      }
      if (usagePayload) {
        await this.recordUsage(user, usagePayload);
      } else {
        await this.recordUsage(user, null, this.estimateTokens(dto.question));
      }
    } catch (err) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: 'assistant failed' })}\n\n`);
    } finally {
      res.end();
    }
  }

  async getUsageSummary(user: AssistantUserPayload) {
    if (!user?.sub || !user.role) {
      return { allowed: false, usedTokens: 0, limitTokens: 0 };
    }
    if (user.role === UserRole.ADMIN) {
      return { allowed: false, usedTokens: 0, limitTokens: 0 };
    }

    const weekStart = this.getWeekStartKey();
    let record: AssistantTokenUsageEntity | null = null;
    try {
      record = await this.usageRepo.findOne({
        where: { userId: user.sub, weekStart },
      });

      if (!record) {
        record = this.usageRepo.create({
          userId: user.sub,
          role: user.role,
          weekStart,
          usedTokens: 0,
        });
        record = await this.usageRepo.save(record);
      }
    } catch (err) {
      if (err instanceof QueryFailedError) {
        return { allowed: false, usedTokens: 0, limitTokens: 0 };
      }
      throw err;
    }

    const limitTokens =
      user.role === UserRole.STUDENT ? 2000 : user.role === UserRole.TEACHER ? 10000 : 0;
    const allowed = limitTokens === 0 ? false : record.usedTokens < limitTokens;

    return {
      allowed,
      usedTokens: record.usedTokens,
      limitTokens,
      weekStart,
    };
  }

  private getWeekStartKey(date = new Date()) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const dayOfMonth = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${dayOfMonth}`;
  }

  private extractTotalTokens(usage?: Record<string, unknown> | null) {
    if (!usage) return 0;
    const total =
      Number((usage as any).total_tokens ?? (usage as any).totalTokens ?? 0);
    if (Number.isFinite(total) && total > 0) return total;
    const input = Number((usage as any).input_tokens ?? 0);
    const output = Number((usage as any).output_tokens ?? 0);
    const sum = input + output;
    return Number.isFinite(sum) ? sum : 0;
  }

  private estimateTokens(text: string) {
    if (!text) return 0;
    return Math.max(1, Math.ceil(text.length / 2));
  }

  private async recordUsage(
    user: AssistantUserPayload,
    usage?: Record<string, unknown> | null,
    fallbackTokens = 0,
  ) {
    if (!user?.sub || !user.role) return;
    if (user.role === UserRole.ADMIN) return;
    const tokens = this.extractTotalTokens(usage) || fallbackTokens;
    if (!tokens) return;

    const weekStart = this.getWeekStartKey();
    try {
      let record = await this.usageRepo.findOne({
        where: { userId: user.sub, weekStart },
      });
      if (!record) {
        record = this.usageRepo.create({
          userId: user.sub,
          role: user.role,
          weekStart,
          usedTokens: 0,
        });
      }
      record.usedTokens += tokens;
      record.updatedAt = new Date();
      await this.usageRepo.save(record);
    } catch (err) {
      if (err instanceof QueryFailedError) {
        return;
      }
      throw err;
    }
  }

  async getStats(dto: AssistantStatsDto, user: AssistantUserPayload) {
    if (!user?.sub || !user.role) {
      throw new BadRequestException('缺少用户信息');
    }

    if (user.role === UserRole.ADMIN) {
      throw new ForbiddenException('管理员暂不支持该功能');
    }

    const userRecord = await this.userRepo.findOne({ where: { id: user.sub } });
    const userInfo = userRecord
      ? {
          userId: userRecord.id,
          name: userRecord.name ?? null,
          account: userRecord.account,
          accountType: userRecord.accountType,
          role: userRecord.role,
          schoolId: userRecord.schoolId,
        }
      : {
          userId: user.sub,
          name: null,
          account: null,
          accountType: null,
          role: user.role,
          schoolId: user.schoolId ?? null,
        };

    const qb = this.scoreRepo
      .createQueryBuilder('s')
      .innerJoin(SubmissionVersionEntity, 'v', 'v.id = s.submissionVersionId')
      .innerJoin(AssignmentEntity, 'a', 'a.id = v.assignmentId')
      .innerJoin(CourseEntity, 'c', 'c.id = a.courseId')
      .where('s.isFinal = :isFinal', { isFinal: true });

    if (user.role === UserRole.STUDENT) {
      qb.andWhere('v.studentId = :studentId', { studentId: user.sub });
    }

    if (user.role === UserRole.TEACHER) {
      if (dto.courseId) {
        const course = await this.courseRepo.findOne({
          where: { id: dto.courseId },
        });
        if (!course) {
          throw new NotFoundException('课程不存在');
        }
        if (course.teacherId !== user.sub) {
          throw new ForbiddenException('无权查看该课程');
        }
        qb.andWhere('a.courseId = :courseId', { courseId: dto.courseId });
      } else {
        const courses = await this.courseRepo.find({
          where: { teacherId: user.sub },
        });
        const courseIds = courses.map((c) => c.id);
        if (!courseIds.length) {
        return {
          stats: { count: 0 },
          scope: {
            role: user.role,
            courseId: null,
            assignmentId: null,
            user: userInfo,
          },
        };
      }
      qb.andWhere('a.courseId IN (:...courseIds)', { courseIds });
    }
    }

    if (dto.courseId && user.role !== UserRole.TEACHER) {
      qb.andWhere('a.courseId = :courseId', { courseId: dto.courseId });
    }

    if (dto.assignmentId) {
      qb.andWhere('v.assignmentId = :assignmentId', {
        assignmentId: dto.assignmentId,
      });
    }

    const statsRow = await qb
      .clone()
      .select('COUNT(*)', 'count')
      .addSelect('AVG(s.totalScore)', 'avg')
      .addSelect('MIN(s.totalScore)', 'min')
      .addSelect('MAX(s.totalScore)', 'max')
      .getRawOne();

    const count = Number(statsRow?.count ?? 0);
    const avg = statsRow?.avg !== null && statsRow?.avg !== undefined ? Number(statsRow.avg) : null;
    const min = statsRow?.min !== null && statsRow?.min !== undefined ? Number(statsRow.min) : null;
    const max = statsRow?.max !== null && statsRow?.max !== undefined ? Number(statsRow.max) : null;

    const trendRows = await qb
      .clone()
      .select('a.id', 'assignmentId')
      .addSelect('a.title', 'assignmentTitle')
      .addSelect('AVG(s.totalScore)', 'value')
      .groupBy('a.id')
      .addGroupBy('a.title')
      .orderBy('a.createdAt', 'ASC')
      .getRawMany();

    const byAssignment = trendRows.map((row: any) => ({
      assignmentId: row.assignmentId,
      assignmentTitle: row.assignmentTitle,
      avgScore: Number(row.value),
    }));

    return {
      stats: {
        count,
        avg,
        min,
        max,
        byAssignment,
      },
      scope: {
        role: user.role,
        courseId: dto.courseId ?? null,
        assignmentId: dto.assignmentId ?? null,
        user: userInfo,
      },
    };
  }
}
