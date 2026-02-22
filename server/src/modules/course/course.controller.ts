import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';
import { CourseService } from './course.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CourseQueryDto } from './dto/course-query.dto';

@Controller('courses')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.TEACHER, UserRole.ADMIN)
export class CourseController {
  constructor(private readonly courseService: CourseService) {}

  @Post()
  async createCourse(
    @Body() body: CreateCourseDto,
    @Req() req: { user?: { sub?: string; role?: UserRole; schoolId?: string } },
  ) {
    return this.courseService.createCourse(body, req.user ?? {});
  }

  @Get()
  async listCourses(
    @Query() query: CourseQueryDto,
    @Req() req: { user?: { sub?: string; role?: UserRole; schoolId?: string } },
  ) {
    return this.courseService.listCourses(query, req.user ?? {});
  }

  @Get(':courseId')
  async getCourse(
    @Param('courseId') courseId: string,
    @Req() req: { user?: { sub?: string; role?: UserRole; schoolId?: string } },
  ) {
    return this.courseService.getCourse(courseId, req.user ?? {});
  }

  @Get(':courseId/summary')
  async getCourseSummary(
    @Param('courseId') courseId: string,
    @Req() req: { user?: { sub?: string; role?: UserRole; schoolId?: string } },
  ) {
    return this.courseService.getCourseSummary(courseId, req.user ?? {});
  }

  @Get(':courseId/students')
  async listCourseStudents(
    @Param('courseId') courseId: string,
    @Req() req: { user?: { sub?: string; role?: UserRole; schoolId?: string } },
  ) {
    return this.courseService.listCourseStudents(courseId, req.user ?? {});
  }

  @Get(':courseId/gradebook')
  async getCourseGradebook(
    @Param('courseId') courseId: string,
    @Req() req: { user?: { sub?: string; role?: UserRole; schoolId?: string } },
  ) {
    return this.courseService.getCourseGradebook(courseId, req.user ?? {});
  }

  @Patch(':courseId')
  async updateCourse(
    @Param('courseId') courseId: string,
    @Body() body: UpdateCourseDto,
    @Req() req: { user?: { sub?: string; role?: UserRole; schoolId?: string } },
  ) {
    return this.courseService.updateCourse(courseId, body, req.user ?? {});
  }

  @Delete(':courseId')
  async deleteCourse(
    @Param('courseId') courseId: string,
    @Req() req: { user?: { sub?: string; role?: UserRole; schoolId?: string } },
  ) {
    return this.courseService.deleteCourse(courseId, req.user ?? {});
  }

  @Post(':courseId/students')
  async addCourseStudent(
    @Param('courseId') courseId: string,
    @Body() body: { account?: string; name?: string },
    @Req() req: { user?: { sub?: string; role?: UserRole; schoolId?: string } },
  ) {
    return this.courseService.addCourseStudent(
      courseId,
      body?.account ?? '',
      body?.name ?? '',
      req.user ?? {},
    );
  }

  @Delete(':courseId/students/:studentId')
  @HttpCode(200)
  async removeCourseStudent(
    @Param('courseId') courseId: string,
    @Param('studentId') studentId: string,
    @Req() req: { user?: { sub?: string; role?: UserRole; schoolId?: string } },
  ) {
    return this.courseService.removeCourseStudent(courseId, studentId, req.user ?? {});
  }
}
