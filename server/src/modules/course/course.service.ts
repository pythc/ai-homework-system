import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { CourseEntity, CourseStatus } from '../assignment/entities/course.entity';
import {
  AccountType,
  UserEntity,
  UserRole,
  UserStatus,
} from '../auth/entities/user.entity';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CourseQueryDto } from './dto/course-query.dto';

type RequestUser = {
  sub?: string;
  role?: UserRole;
  schoolId?: string;
};

@Injectable()
export class CourseService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(CourseEntity)
    private readonly courseRepo: Repository<CourseEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  async createCourse(dto: CreateCourseDto, requester: RequestUser) {
    const schoolId = requester.schoolId;
    if (!schoolId) {
      throw new BadRequestException('缺少 schoolId');
    }

    const isTeacher = requester.role === UserRole.TEACHER;
    const teacherId = dto.teacherId ?? requester.sub;
    if (!teacherId) {
      throw new BadRequestException('缺少 teacherId');
    }
    if (isTeacher && teacherId !== requester.sub) {
      throw new ForbiddenException('教师不可为他人创建课程');
    }

    const teacher = await this.userRepo.findOne({
      where: { id: teacherId, schoolId },
    });
    if (!teacher || teacher.role !== UserRole.TEACHER) {
      throw new BadRequestException('教师不存在或角色不匹配');
    }

    const exists = await this.courseRepo.findOne({
      where: {
        schoolId,
        name: dto.name,
        semester: dto.semester,
      },
    });
    if (exists) {
      throw new ConflictException('课程已存在');
    }

    const course = this.courseRepo.create({
      schoolId,
      name: dto.name,
      semester: dto.semester,
      teacherId,
      status: dto.status ?? CourseStatus.ACTIVE,
    });
    const saved = await this.courseRepo.save(course);
    return this.toCourseResponse(saved, teacher);
  }

  async listCourses(query: CourseQueryDto, requester: RequestUser) {
    const schoolId = requester.schoolId;
    if (!schoolId) {
      throw new BadRequestException('缺少 schoolId');
    }

    const qb = this.courseRepo.createQueryBuilder('course');
    qb.where('course.school_id = :schoolId', { schoolId });

    if (requester.role === UserRole.TEACHER) {
      qb.andWhere('course.teacher_id = :teacherId', {
        teacherId: requester.sub,
      });
    } else if (query.teacherId) {
      qb.andWhere('course.teacher_id = :teacherId', {
        teacherId: query.teacherId,
      });
    }

    if (query.status) {
      qb.andWhere('course.status = :status', { status: query.status });
    }

    if (query.semester) {
      qb.andWhere('course.semester = :semester', { semester: query.semester });
    }

    qb.orderBy('course.created_at', 'DESC');
    const courses = await qb.getMany();
    const teacherIds = Array.from(
      new Set(courses.map((course) => course.teacherId).filter(Boolean)),
    );
    const teachers = teacherIds.length
      ? await this.userRepo.find({ where: { id: In(teacherIds) } })
      : [];
    const teacherMap = new Map(teachers.map((teacher) => [teacher.id, teacher]));
    return {
      items: courses.map((course) =>
        this.toCourseResponse(course, teacherMap.get(course.teacherId) ?? null),
      ),
    };
  }

  async getCourse(courseId: string, requester: RequestUser) {
    const course = await this.courseRepo.findOne({
      where: { id: courseId },
    });
    if (!course) {
      throw new NotFoundException('课程不存在');
    }
    this.assertCourseAccess(course, requester);
    const teacher = await this.userRepo.findOne({
      where: { id: course.teacherId },
    });
    return this.toCourseResponse(course, teacher ?? null);
  }

  async getCourseSummary(courseId: string, requester: RequestUser) {
    const course = await this.courseRepo.findOne({
      where: { id: courseId },
    });
    if (!course) {
      throw new NotFoundException('课程不存在');
    }
    this.assertCourseAccess(course, requester);

    const rows = await this.dataSource.query(
      `
        SELECT
          COUNT(DISTINCT cs.student_id) AS "studentCount",
          COUNT(DISTINCT a.id) AS "assignmentCount"
        FROM courses c
        LEFT JOIN course_students cs
          ON cs.course_id = c.id
          AND cs.status = 'ENROLLED'
        LEFT JOIN assignments a ON a.course_id = c.id
        WHERE c.id = $1
        GROUP BY c.id
      `,
      [courseId],
    );
    const row = rows[0] ?? {};
    const teacher = await this.userRepo.findOne({
      where: { id: course.teacherId },
    });
    return {
      course: this.toCourseResponse(course, teacher ?? null),
      studentCount: Number(row.studentCount ?? 0),
      assignmentCount: Number(row.assignmentCount ?? 0),
    };
  }

  async listCourseStudents(courseId: string, requester: RequestUser) {
    const course = await this.courseRepo.findOne({
      where: { id: courseId },
    });
    if (!course) {
      throw new NotFoundException('课程不存在');
    }
    this.assertCourseAccess(course, requester);

    const rows = await this.dataSource.query(
      `
        SELECT
          u.id AS "studentId",
          u.name AS "studentName",
          u.account AS "studentAccount"
        FROM course_students cs
        INNER JOIN users u ON u.id = cs.student_id
        WHERE cs.course_id = $1
          AND cs.status = 'ENROLLED'
        ORDER BY u.name NULLS LAST, u.account NULLS LAST
      `,
      [courseId],
    );

    return {
      items: rows.map((row: any) => ({
        studentId: row.studentId,
        name: this.normalizeDisplayName(row.studentName),
        account: row.studentAccount ?? null,
      })),
    };
  }

  async getCourseGradebook(courseId: string, requester: RequestUser) {
    const course = await this.courseRepo.findOne({
      where: { id: courseId },
    });
    if (!course) {
      throw new NotFoundException('课程不存在');
    }
    this.assertCourseAccess(course, requester);

    const students = await this.dataSource.query(
      `
        SELECT
          u.id AS "studentId",
          u.name AS "studentName",
          u.account AS "studentAccount"
        FROM course_students cs
        INNER JOIN users u ON u.id = cs.student_id
        WHERE cs.course_id = $1
          AND cs.status = 'ENROLLED'
        ORDER BY u.name NULLS LAST, u.account NULLS LAST
      `,
      [courseId],
    );

    const assignments = await this.dataSource.query(
      `
        SELECT
          a.id,
          a.title,
          a.total_score AS "totalScore",
          a.deadline,
          a.created_at AS "createdAt"
        FROM assignments a
        WHERE a.course_id = $1
        ORDER BY a.created_at ASC, a.deadline NULLS LAST
      `,
      [courseId],
    );
    const assignmentIds = assignments.map((row: any) => row.id);

    const snapshots = assignmentIds.length
      ? await this.dataSource.query(
          `
            SELECT DISTINCT ON (assignment_id)
              assignment_id AS "assignmentId",
              id,
              snapshot
            FROM assignment_snapshots
            WHERE assignment_id = ANY($1)
            ORDER BY assignment_id, created_at DESC
          `,
          [assignmentIds],
        )
      : [];

    const snapshotMap = new Map<string, any>();
    for (const row of snapshots) {
      const questions = Array.isArray(row.snapshot?.questions)
        ? row.snapshot.questions
        : [];
      const normalized = questions
        .map((q: any) => {
          const rubricItems = Array.isArray(q?.rubric) ? q.rubric : [];
          const maxScore = rubricItems.reduce((sum: number, item: any) => {
            const value = Number(item?.maxScore ?? 0);
            return Number.isFinite(value) ? sum + value : sum;
          }, 0);
          const weight = Number(q?.weight ?? 0);
          return {
            questionId: q?.questionId,
            questionIndex: Number(q?.questionIndex),
            maxScore: Number.isFinite(maxScore) ? maxScore : 0,
            weight:
              Number.isFinite(weight) && weight > 0
                ? weight
                : null,
          };
        })
        .filter((q: any) => q.questionId && Number.isFinite(q.questionIndex))
        .sort((a: any, b: any) => a.questionIndex - b.questionIndex);
      snapshotMap.set(row.assignmentId, normalized);
    }

    const assignmentMetaMap = new Map<
      string,
      {
        totalScore: number;
        questionCount: number;
        defaultWeight: number;
        questions: Array<{
          questionId: string;
          questionIndex: number;
          maxScore: number;
          weight: number | null;
        }>;
      }
    >();

    for (const assignment of assignments) {
      const questions = (snapshotMap.get(assignment.id) ?? []) as Array<{
        questionId: string;
        questionIndex: number;
        maxScore: number;
        weight: number | null;
      }>;
      const weightSum = questions.reduce((sum, q) => {
        const weight = Number(q.weight ?? 0);
        return Number.isFinite(weight) && weight > 0 ? sum + weight : sum;
      }, 0);
      const defaultWeight =
        questions.length > 0 && weightSum === 0 ? 100 / questions.length : 0;
      const assignmentTotalScore = Number(assignment.totalScore ?? 100);
      assignmentMetaMap.set(assignment.id, {
        totalScore: Number.isFinite(assignmentTotalScore)
          ? assignmentTotalScore
          : 100,
        questionCount: questions.length,
        defaultWeight,
        questions,
      });
    }

    const submissions = assignmentIds.length
      ? await this.dataSource.query(
          `
            SELECT
              s.assignment_id AS "assignmentId",
              s.student_id AS "studentId",
              s.question_id AS "questionId",
              s.current_version_id AS "submissionVersionId"
            FROM submissions s
            WHERE s.assignment_id = ANY($1)
          `,
          [assignmentIds],
        )
      : [];

    const versionIds = submissions
      .map((row: any) => row.submissionVersionId)
      .filter(Boolean);

    const finalScores = versionIds.length
      ? await this.dataSource.query(
          `
            SELECT
              submission_version_id AS "submissionVersionId",
              total_score AS "totalScore"
            FROM scores
            WHERE is_final = true
              AND submission_version_id = ANY($1)
          `,
          [versionIds],
        )
      : [];

    const aiScores = versionIds.length
      ? await this.dataSource.query(
          `
            SELECT DISTINCT ON (submission_version_id)
              submission_version_id AS "submissionVersionId",
              result
            FROM ai_gradings
            WHERE submission_version_id = ANY($1)
            ORDER BY submission_version_id, created_at DESC
          `,
          [versionIds],
        )
      : [];

    const finalMap = new Map<string, number>();
    for (const row of finalScores) {
      const value = Number(row.totalScore);
      finalMap.set(row.submissionVersionId, Number.isFinite(value) ? value : 0);
    }

    const aiMap = new Map<string, number>();
    for (const row of aiScores) {
      const value = Number((row.result as any)?.totalScore);
      if (Number.isFinite(value)) {
        aiMap.set(row.submissionVersionId, value);
      }
    }

    const studentIds = students.map((row: any) => row.studentId).filter(Boolean);
    let weightedRows: any[] = [];
    if (assignmentIds.length && studentIds.length) {
      try {
        weightedRows = await this.dataSource.query(
          `
            SELECT
              assignment_id AS "assignmentId",
              student_id AS "studentId",
              total_score AS "totalScore"
            FROM assignment_weighted_scores
            WHERE assignment_id = ANY($1)
              AND student_id = ANY($2)
          `,
          [assignmentIds, studentIds],
        );
      } catch (_err) {
        weightedRows = [];
      }
    }

    const weightedMap = new Map<string, number>();
    for (const row of weightedRows) {
      const value = Number(row.totalScore);
      if (!Number.isFinite(value)) continue;
      weightedMap.set(`${row.studentId}:${row.assignmentId}`, value);
    }

    const perQuestionMap = new Map<
      string,
      { score: number | null; fromAi: boolean; submissionVersionId: string | null }
    >();
    const pairSubmissionMap = new Map<string, string>();

    for (const row of submissions) {
      const key = `${row.studentId}:${row.assignmentId}:${row.questionId}`;
      const pairKey = `${row.studentId}:${row.assignmentId}`;
      const versionId = row.submissionVersionId ?? null;
      if (!pairSubmissionMap.has(pairKey) && versionId) {
        pairSubmissionMap.set(pairKey, versionId);
      }
      const finalScore = finalMap.get(row.submissionVersionId);
      if (finalScore !== undefined) {
        perQuestionMap.set(key, {
          score: finalScore,
          fromAi: false,
          submissionVersionId: versionId,
        });
        continue;
      }
      const aiScore = aiMap.get(row.submissionVersionId);
      if (aiScore !== undefined) {
        perQuestionMap.set(key, {
          score: aiScore,
          fromAi: true,
          submissionVersionId: versionId,
        });
        continue;
      }
      perQuestionMap.set(key, {
        score: null,
        fromAi: false,
        submissionVersionId: versionId,
      });
    }

    const cells: Array<{
      studentId: string;
      assignmentId: string;
      submissionVersionId: string | null;
      finalScore: number | null;
      aiScore: number | null;
    }> = [];

    for (const studentId of studentIds) {
      for (const assignmentId of assignmentIds) {
        const pairKey = `${studentId}:${assignmentId}`;
        const submissionVersionId = pairSubmissionMap.get(pairKey) ?? null;
        const publishedTotal = weightedMap.get(pairKey);
        if (publishedTotal !== undefined) {
          cells.push({
            studentId,
            assignmentId,
            submissionVersionId,
            finalScore: Number(publishedTotal.toFixed(2)),
            aiScore: null,
          });
          continue;
        }

        const meta = assignmentMetaMap.get(assignmentId);
        if (!meta || meta.questionCount === 0 || meta.totalScore <= 0) {
          continue;
        }

        let weightedTotal = 0;
        let allScored = true;
        let hasAiDerived = false;
        for (const question of meta.questions) {
          const qKey = `${studentId}:${assignmentId}:${question.questionId}`;
          const scoreRow = perQuestionMap.get(qKey);
          if (!scoreRow || scoreRow.score === null || !Number.isFinite(scoreRow.score)) {
            allScored = false;
            break;
          }
          if (!Number.isFinite(question.maxScore) || question.maxScore <= 0) {
            allScored = false;
            break;
          }
          const weight = question.weight ?? meta.defaultWeight;
          if (!Number.isFinite(weight) || weight <= 0) {
            allScored = false;
            break;
          }
          const normalized = scoreRow.score / question.maxScore;
          weightedTotal += normalized * (weight / 100) * meta.totalScore;
          if (scoreRow.fromAi) {
            hasAiDerived = true;
          }
        }

        if (!allScored) continue;
        const rounded = Number(weightedTotal.toFixed(2));
        cells.push({
          studentId,
          assignmentId,
          submissionVersionId,
          finalScore: hasAiDerived ? null : rounded,
          aiScore: hasAiDerived ? rounded : null,
        });
      }
    }

    return {
      course: this.toCourseResponse(course),
      students: students.map((row: any) => ({
        studentId: row.studentId,
        name: this.normalizeDisplayName(row.studentName),
        account: row.studentAccount ?? null,
      })),
      assignments: assignments.map((row: any, index: number) => ({
        id: row.id,
        title: row.title,
        totalScore: Number(row.totalScore ?? 100),
        deadline: row.deadline ?? null,
        order: index + 1,
        questions: snapshotMap.get(row.id) ?? [],
      })),
      cells,
    };
  }

  async updateCourse(
    courseId: string,
    dto: UpdateCourseDto,
    requester: RequestUser,
  ) {
    const course = await this.courseRepo.findOne({
      where: { id: courseId },
    });
    if (!course) {
      throw new NotFoundException('课程不存在');
    }
    this.assertCourseAccess(course, requester);

    const isTeacher = requester.role === UserRole.TEACHER;
    if (isTeacher && dto.teacherId) {
      throw new ForbiddenException('教师不可修改授课教师');
    }

    const newName = dto.name ?? course.name;
    const newSemester = dto.semester ?? course.semester;
    if (newName !== course.name || newSemester !== course.semester) {
      const exists = await this.courseRepo.findOne({
        where: {
          schoolId: course.schoolId,
          name: newName,
          semester: newSemester,
        },
      });
      if (exists && exists.id !== course.id) {
        throw new ConflictException('课程名称与学期组合已存在');
      }
    }

    if (dto.teacherId) {
      const teacher = await this.userRepo.findOne({
        where: {
          id: dto.teacherId,
          schoolId: course.schoolId,
        },
      });
      if (!teacher || teacher.role !== UserRole.TEACHER) {
        throw new BadRequestException('教师不存在或角色不匹配');
      }
      course.teacherId = dto.teacherId;
    }

    course.name = newName;
    course.semester = newSemester;
    course.status = dto.status ?? course.status;
    course.updatedAt = new Date();

    const saved = await this.courseRepo.save(course);
    const teacher = await this.userRepo.findOne({
      where: { id: saved.teacherId },
    });
    return this.toCourseResponse(saved, teacher ?? null);
  }

  async deleteCourse(courseId: string, requester: RequestUser) {
    const course = await this.courseRepo.findOne({
      where: { id: courseId },
    });
    if (!course) {
      throw new NotFoundException('课程不存在');
    }
    this.assertCourseAccess(course, requester);

    await this.courseRepo.delete({ id: courseId });
    return { success: true };
  }

  async addCourseStudent(
    courseId: string,
    accountRaw: string,
    nameRaw: string,
    requester: RequestUser,
  ) {
    const course = await this.courseRepo.findOne({
      where: { id: courseId },
    });
    if (!course) {
      throw new NotFoundException('课程不存在');
    }
    this.assertCourseAccess(course, requester);

    const account = String(accountRaw ?? '').trim();
    if (!account) {
      throw new BadRequestException('学生学号不能为空');
    }
    const inputName = String(nameRaw ?? '').trim();
    if (!inputName) {
      throw new BadRequestException('学生姓名不能为空');
    }

    const student = await this.userRepo.findOne({
      where: {
        schoolId: course.schoolId,
        account,
      },
    });
    let targetStudent = student;
    let created = false;
    if (!targetStudent) {
      const passwordHash = await bcrypt.hash('123456', 10);
      targetStudent = await this.userRepo.save(
        this.userRepo.create({
          schoolId: course.schoolId,
          accountType: AccountType.USERNAME,
          account,
          role: UserRole.STUDENT,
          name: inputName,
          status: UserStatus.ACTIVE,
          passwordHash,
        }),
      );
      created = true;
    } else if (targetStudent.role !== UserRole.STUDENT) {
      throw new BadRequestException('该账号不是学生身份，无法加入班级');
    } else if (!this.normalizeDisplayName(targetStudent.name) && inputName) {
      targetStudent.name = inputName;
      targetStudent = await this.userRepo.save(targetStudent);
    }

    await this.dataSource.query(
      `
        INSERT INTO course_students (course_id, student_id, status)
        VALUES ($1, $2, 'ENROLLED')
        ON CONFLICT (course_id, student_id)
        DO UPDATE SET status = 'ENROLLED', updated_at = now()
      `,
      [courseId, targetStudent.id],
    );

    return {
      success: true,
      created,
      defaultPassword: created ? '123456' : null,
      student: {
        studentId: targetStudent.id,
        name: this.normalizeDisplayName(targetStudent.name),
        account: targetStudent.account ?? null,
      },
    };
  }

  async removeCourseStudent(
    courseId: string,
    studentId: string,
    requester: RequestUser,
  ) {
    const course = await this.courseRepo.findOne({
      where: { id: courseId },
    });
    if (!course) {
      throw new NotFoundException('课程不存在');
    }
    this.assertCourseAccess(course, requester);

    await this.dataSource.query(
      `
        UPDATE course_students
        SET status = 'DROPPED', updated_at = now()
        WHERE course_id = $1 AND student_id = $2
      `,
      [courseId, studentId],
    );
    return { success: true };
  }

  private assertCourseAccess(course: CourseEntity, requester: RequestUser) {
    if (!requester.schoolId || course.schoolId !== requester.schoolId) {
      throw new ForbiddenException('无权访问该课程');
    }
    if (
      requester.role === UserRole.TEACHER &&
      course.teacherId !== requester.sub
    ) {
      throw new ForbiddenException('无权访问该课程');
    }
  }

  private normalizeDisplayName(value: unknown): string | null {
    const parsed = this.extractCellText(value);
    if (!parsed) return null;
    const text = parsed.trim();
    if (!text || text === '[object Object]') return null;
    return text;
  }

  private extractCellText(value: unknown): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    if (Array.isArray(value)) {
      return value.map((item) => this.extractCellText(item)).join('');
    }
    if (typeof value === 'object') {
      const record = value as Record<string, unknown>;
      if (typeof record.text === 'string') return record.text;
      if (Array.isArray(record.richText)) {
        return record.richText
          .map((item) => this.extractCellText(item))
          .join('');
      }
      if (typeof record.name === 'string') return record.name;
      if (typeof record.value === 'string') return record.value;
      return '';
    }
    return '';
  }

  private toCourseResponse(
    course: CourseEntity,
    teacher: UserEntity | null = null,
  ) {
    return {
      id: course.id,
      schoolId: course.schoolId,
      name: course.name,
      semester: course.semester,
      teacherId: course.teacherId,
      teacherName: this.normalizeDisplayName(teacher?.name ?? null),
      teacherAccount: teacher?.account ?? null,
      status: course.status,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
    };
  }
}
