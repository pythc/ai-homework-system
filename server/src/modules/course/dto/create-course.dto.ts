import { IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { CourseStatus } from '../../assignment/entities/course.entity';

export class CreateCourseDto {
  @IsString()
  @MinLength(1)
  name!: string;

  @IsString()
  @MinLength(1)
  semester!: string;

  @IsOptional()
  @IsUUID()
  teacherId?: string;

  @IsOptional()
  @IsEnum(CourseStatus)
  status?: CourseStatus;
}
