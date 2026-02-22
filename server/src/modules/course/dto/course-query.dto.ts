import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { CourseStatus } from '../../assignment/entities/course.entity';

export class CourseQueryDto {
  @IsOptional()
  @IsUUID()
  teacherId?: string;

  @IsOptional()
  @IsEnum(CourseStatus)
  status?: CourseStatus;

  @IsOptional()
  @IsString()
  semester?: string;
}
