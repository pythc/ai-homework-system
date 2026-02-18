import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { CourseEntity, CourseStatus } from '../assignment/entities/course.entity';
import { UserEntity, UserRole } from '../auth/entities/user.entity';
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
        name: row.studentName ?? null,
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
        .map((q: any) => ({
          questionId: q?.questionId,
          questionIndex: Number(q?.questionIndex),
        }))
        .filter((q: any) => q.questionId && Number.isFinite(q.questionIndex))
        .sort((a: any, b: any) => a.questionIndex - b.questionIndex);
      snapshotMap.set(row.assignmentId, normalized);
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

    const cells = submissions.map((row: any) => ({
      studentId: row.studentId,
      assignmentId: row.assignmentId,
      questionId: row.questionId,
      submissionVersionId: row.submissionVersionId,
      finalScore: finalMap.get(row.submissionVersionId) ?? null,
      aiScore: aiMap.get(row.submissionVersionId) ?? null,
    }));

    return {
      course: this.toCourseResponse(course),
      students: students.map((row: any) => ({
        studentId: row.studentId,
        name: row.studentName ?? null,
        account: row.studentAccount ?? null,
      })),
      assignments: assignments.map((row: any, index: number) => ({
        id: row.id,
        title: row.title,
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
    if (isTeacher && (dto.teacherId || dto.status)) {
      throw new ForbiddenException('教师不可修改授课教师或课程状态');
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
      teacherName: teacher?.name ?? null,
      teacherAccount: teacher?.account ?? null,
      status: course.status,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
    };
  }
}
