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

    try {
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
    } catch (error) {
      return {
        answer: this.buildAssistantFallbackMessage(error),
        scope: stats.scope,
        stats: stats.stats,
      };
    }
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

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    if (typeof (res as any).flushHeaders === 'function') {
      (res as any).flushHeaders();
    }

    let stream: any = null;
    try {
      stream = await this.assistantClient.answerStream(
        dto.question,
        stats.stats,
        stats.scope,
        dto.sessionId,
        dto.thinking,
        dto.images,
      );
    } catch (error) {
      res.write(
        `event: done\ndata: ${JSON.stringify({
          answer: this.buildAssistantFallbackMessage(error),
          scope: stats.scope,
          stats: stats.stats,
        })}\n\n`,
      );
      res.end();
      return;
    }

    if (!stream) {
      res.write(
        `event: done\ndata: ${JSON.stringify({
          answer: this.buildAssistantFallbackMessage(),
          scope: stats.scope,
          stats: stats.stats,
        })}\n\n`,
      );
      res.end();
      return;
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
      res.write(
        `event: done\ndata: ${JSON.stringify({
          answer: this.buildAssistantFallbackMessage(err),
          scope: stats.scope,
          stats: stats.stats,
        })}\n\n`,
      );
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

  private buildAssistantFallbackMessage(error?: unknown) {
    const message = error instanceof Error ? error.message : String(error ?? '');
    if (message.includes('timeout')) {
      return '请求超时，模型暂时繁忙，请稍后重试。';
    }
    return '服务暂时不可用，请稍后重试。';
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

    const whereClauses: string[] = [];
    const params: Array<string> = [];

    if (user.role === UserRole.STUDENT) {
      params.push(user.sub);
      whereClauses.push(`aws.student_id = $${params.length}`);
    }

    if (user.role === UserRole.TEACHER) {
      params.push(user.sub);
      whereClauses.push(`c.teacher_id = $${params.length}`);
    }

    if (dto.courseId) {
      params.push(dto.courseId);
      whereClauses.push(`a.course_id = $${params.length}`);
    }

    if (dto.assignmentId) {
      params.push(dto.assignmentId);
      whereClauses.push(`aws.assignment_id = $${params.length}`);
    }

    const whereSql = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const baseSql = `
      FROM assignment_weighted_scores aws
      JOIN assignments a ON a.id = aws.assignment_id
      JOIN courses c ON c.id = a.course_id
      ${whereSql}
    `;

    const statsRows = await this.dataSource.query(
      `SELECT
         COUNT(DISTINCT aws.student_id)::int AS count,
         AVG(aws.total_score)::float AS avg,
         MIN(aws.total_score)::float AS min,
         MAX(aws.total_score)::float AS max
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

    let byAssignment: Array<{
      assignmentId: string;
      assignmentTitle: string;
      avgScore: number | null;
    }> = [];
    if (this.shouldIncludeByAssignment(question ?? '', dto)) {
      const trendRows = await this.dataSource.query(
        `SELECT
           a.id AS "assignmentId",
           a.title AS "assignmentTitle",
           AVG(aws.total_score)::float AS value,
           MIN(a.created_at) AS "createdAt"
         ${baseSql}
         GROUP BY a.id, a.title
         ORDER BY MIN(a.created_at) ASC`,
        params,
      );
      byAssignment = (trendRows ?? []).map((row: any) => ({
        assignmentId: row.assignmentId,
        assignmentTitle: row.assignmentTitle,
        avgScore: row.value !== null && row.value !== undefined ? Number(row.value) : null,
      }));
    }

    const meta = await this.buildMeta(dto, user);

    return {
      stats: {
        count,
        avg,
        min,
        max,
        byAssignment,
        meta,
      },
      scope: {
        role: user.role,
        courseId: dto.courseId ?? null,
        assignmentId: dto.assignmentId ?? null,
        user: userInfo,
      },
    };
  }

  private async buildMeta(dto: AssistantStatsDto, user: AssistantUserPayload) {
    const courses = await this.loadCourses(dto, user);
    const assignments = await this.loadAssignments(dto, user);
    const students = await this.loadStudents(dto, user);
    const studentCount = students.reduce((sum, item) => sum + item.students.length, 0);
    return {
      counts: {
        courses: courses.length,
        assignments: assignments.length,
        students: studentCount,
      },
      courses,
      assignments,
      students: user.role === UserRole.TEACHER ? students : [],
    };
  }

  private async loadCourses(dto: AssistantStatsDto, user: AssistantUserPayload) {
    const params: Array<string> = [];
    let whereSql = '';
    if (user.role === UserRole.STUDENT) {
      params.push(user.sub ?? '');
      whereSql = `WHERE cs.student_id = $${params.length}`;
    } else {
      params.push(user.sub ?? '');
      whereSql = `WHERE c.teacher_id = $${params.length}`;
    }
    if (dto.courseId) {
      params.push(dto.courseId);
      whereSql += ` AND c.id = $${params.length}`;
    }
    const joinSql =
      user.role === UserRole.STUDENT
        ? 'JOIN assistant.v_course_students cs ON cs.course_id = c.id'
        : '';
    const rows = await this.dataSource.query(
      `
        SELECT
          c.id,
          c.name,
          c.semester,
          c.teacher_id AS "teacherId",
          c.status,
          c.created_at AS "createdAt"
        FROM assistant.v_courses c
        ${joinSql}
        ${whereSql}
        ORDER BY c.created_at DESC
      `,
      params,
    );
    return (rows ?? []).map((row: any) => ({
      courseId: row.id,
      name: row.name,
      semester: row.semester,
      teacherId: row.teacherId,
      status: row.status,
      createdAt: row.createdAt,
    }));
  }

  private async loadAssignments(dto: AssistantStatsDto, user: AssistantUserPayload) {
    const params: Array<string> = [];
    let whereSql = '';
    let joinSql = '';
    if (user.role === UserRole.STUDENT) {
      params.push(user.sub ?? '');
      whereSql = `WHERE cs.student_id = $${params.length}`;
      joinSql = 'JOIN assistant.v_course_students cs ON cs.course_id = a.course_id';
    } else {
      params.push(user.sub ?? '');
      whereSql = `WHERE c.teacher_id = $${params.length}`;
      joinSql = 'JOIN assistant.v_courses c ON c.id = a.course_id';
    }
    if (dto.courseId) {
      params.push(dto.courseId);
      whereSql += ` AND a.course_id = $${params.length}`;
    }
    if (dto.assignmentId) {
      params.push(dto.assignmentId);
      whereSql += ` AND a.id = $${params.length}`;
    }
    const rows = await this.dataSource.query(
      `
        SELECT
          a.id,
          a.course_id AS "courseId",
          a.title,
          a.deadline,
          a.total_score AS "totalScore",
          a.ai_enabled AS "aiEnabled",
          a.status,
          a.created_at AS "createdAt"
        FROM assistant.v_assignments a
        ${joinSql}
        ${whereSql}
        ORDER BY a.created_at DESC
      `,
      params,
    );
    return (rows ?? []).map((row: any) => ({
      assignmentId: row.id,
      courseId: row.courseId,
      title: row.title,
      deadline: row.deadline,
      totalScore: row.totalScore !== null && row.totalScore !== undefined ? Number(row.totalScore) : null,
      aiEnabled: row.aiEnabled,
      status: row.status,
      createdAt: row.createdAt,
    }));
  }

  private async loadStudents(dto: AssistantStatsDto, user: AssistantUserPayload) {
    if (user.role !== UserRole.TEACHER) {
      return [];
    }
    const params: Array<string> = [user.sub ?? ''];
    let whereSql = `WHERE c.teacher_id = $1`;
    if (dto.courseId) {
      params.push(dto.courseId);
      whereSql += ` AND cs.course_id = $${params.length}`;
    }
    const rows = await this.dataSource.query(
      `
        SELECT
          cs.course_id AS "courseId",
          u.id AS "studentId",
          u.name AS "studentName",
          u.account AS "studentAccount",
          u.status AS "studentStatus"
        FROM assistant.v_course_students cs
        JOIN assistant.v_courses c ON c.id = cs.course_id
        JOIN assistant.v_users u ON u.id = cs.student_id
        ${whereSql}
        ORDER BY cs.course_id, u.name NULLS LAST
      `,
      params,
    );
    const grouped = new Map<string, { courseId: string; students: any[] }>();
    for (const row of rows ?? []) {
      const courseId = row.courseId;
      if (!grouped.has(courseId)) {
        grouped.set(courseId, { courseId, students: [] });
      }
      grouped.get(courseId)!.students.push({
        studentId: row.studentId,
        name: row.studentName,
        account: row.studentAccount,
        status: row.studentStatus,
      });
    }
    return Array.from(grouped.values());
  }
}
