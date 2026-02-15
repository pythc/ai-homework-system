import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { AssistantChatDto } from './dto/assistant-chat.dto';
import { AssistantStatsDto } from './dto/assistant-stats.dto';
import { UserRole } from '../auth/entities/user.entity';
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
    private readonly dataSource: DataSource,
    @InjectRepository(AssistantTokenUsageEntity)
    private readonly usageRepo: Repository<AssistantTokenUsageEntity>,
    private readonly assistantClient: AssistantClient,
  ) {}

  async chat(dto: AssistantChatDto, user: AssistantUserPayload) {
    const stats = await this.getStats(dto, user, dto.question);
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
    const stats = await this.getStats(dto, user, dto.question);
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
    const input = Number(
      (usage as any).input_tokens ?? (usage as any).prompt_tokens ?? 0,
    );
    const output = Number(
      (usage as any).output_tokens ?? (usage as any).completion_tokens ?? 0,
    );
    const sum = input + output;
    return Number.isFinite(sum) ? sum : 0;
  }

  private shouldIncludeByAssignment(question: string, dto: AssistantStatsDto) {
    if (dto.assignmentId || dto.courseId) return true;
    if (!question) return false;
    const keywords = [
      '趋势',
      '作业分布',
      '每次作业',
      '作业统计',
      '作业情况',
      '作业成绩',
      '按作业',
      '分布',
      '走势',
    ];
    return keywords.some((keyword) => question.includes(keyword));
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

  async getStats(
    dto: AssistantStatsDto,
    user: AssistantUserPayload,
    question?: string,
  ) {
    if (!user?.sub || !user.role) {
      throw new BadRequestException('缺少用户信息');
    }

    if (user.role === UserRole.ADMIN) {
      throw new ForbiddenException('管理员暂不支持该功能');
    }

    const userRow = await this.dataSource.query(
      `SELECT id, name, account, account_type, role, school_id, email
       FROM assistant.v_users
       WHERE id = $1
       LIMIT 1`,
      [user.sub],
    );
    const record = userRow?.[0];
    const userInfo = record
      ? {
          userId: record.id,
          name: record.name ?? null,
          account: record.account ?? null,
          accountType: record.account_type ?? null,
          role: record.role ?? user.role,
          schoolId: record.school_id ?? user.schoolId ?? null,
          email: record.email ?? null,
        }
      : {
          userId: user.sub,
          name: null,
          account: null,
          accountType: null,
          role: user.role,
          schoolId: user.schoolId ?? null,
          email: null,
        };

    const clauses: string[] = ['s.is_final = true'];
    const params: Array<string> = [];

    if (user.role === UserRole.STUDENT) {
      params.push(user.sub);
      clauses.push(`v.student_id = $${params.length}`);
    }

    if (dto.courseId) {
      params.push(dto.courseId);
      clauses.push(`a.course_id = $${params.length}`);
    }

    if (dto.assignmentId) {
      params.push(dto.assignmentId);
      clauses.push(`v.assignment_id = $${params.length}`);
    }

    const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const baseSql = `
      FROM assistant.v_scores s
      JOIN assistant.v_submission_versions v ON v.id = s.submission_version_id
      JOIN assistant.v_assignments a ON a.id = v.assignment_id
      JOIN assistant.v_courses c ON c.id = a.course_id
      ${whereSql}
    `;

    const statsRows = await this.dataSource.query(
      `SELECT
         COUNT(*)::int AS count,
         AVG(s.total_score)::float AS avg,
         MIN(s.total_score)::float AS min,
         MAX(s.total_score)::float AS max
       ${baseSql}`,
      params,
    );

    const statsRow = statsRows?.[0] ?? {};
    const count = Number(statsRow.count ?? 0);
    const avg =
      statsRow.avg !== null && statsRow.avg !== undefined ? Number(statsRow.avg) : null;
    const min =
      statsRow.min !== null && statsRow.min !== undefined ? Number(statsRow.min) : null;
    const max =
      statsRow.max !== null && statsRow.max !== undefined ? Number(statsRow.max) : null;

    const includeByAssignment = this.shouldIncludeByAssignment(
      question ?? '',
      dto,
    );

    const byAssignment = includeByAssignment
      ? (await this.dataSource.query(
          `SELECT
             a.id AS "assignmentId",
             a.title AS "assignmentTitle",
             AVG(s.total_score)::float AS value,
             MIN(a.created_at) AS "createdAt"
           ${baseSql}
           GROUP BY a.id, a.title
           ORDER BY MIN(a.created_at) ASC`,
          params,
        )).map((row: any) => ({
          assignmentId: row.assignmentId,
          assignmentTitle: row.assignmentTitle,
          avgScore:
            row.value !== null && row.value !== undefined ? Number(row.value) : null,
        }))
      : [];

    return {
      stats: {
        count,
        avg,
        min,
        max,
        ...(includeByAssignment ? { byAssignment } : {}),
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
