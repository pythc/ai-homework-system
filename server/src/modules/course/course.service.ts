import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
    return this.toCourseResponse(saved);
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
    return {
      items: courses.map((course) => this.toCourseResponse(course)),
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
    return this.toCourseResponse(course);
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
    return this.toCourseResponse(saved);
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

  private toCourseResponse(course: CourseEntity) {
    return {
      id: course.id,
      schoolId: course.schoolId,
      name: course.name,
      semester: course.semester,
      teacherId: course.teacherId,
      status: course.status,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
    };
  }
}
