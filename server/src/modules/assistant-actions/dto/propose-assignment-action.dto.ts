import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Max, Min } from 'class-validator';

export class ProposeAssignmentActionDto {
  @ApiPropertyOptional({ description: '用户原始指令' })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  originalText?: string;

  @ApiPropertyOptional({ description: '目标课程ID（可选）' })
  @IsOptional()
  @IsUUID()
  courseId?: string;

  @ApiPropertyOptional({ description: '目标课程名称关键词（可选）' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  courseName?: string;

  @ApiPropertyOptional({ description: '教材名称关键词（可选）' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  textbookTitle?: string;

  @ApiPropertyOptional({ description: '章节名称或编号（可选）' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  chapterTitle?: string;

  @ApiPropertyOptional({ description: '习题标识（可选），如 习题1.1' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  exerciseRef?: string;

  @ApiPropertyOptional({ description: '题号标识（可选），如 第一题/第1题' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  questionRef?: string;

  @ApiPropertyOptional({ description: '题号数字（可选），如 1' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(9999)
  questionNo?: number;

  @ApiPropertyOptional({ description: '作业标题（可选）' })
  @IsOptional()
  @IsString()
  @MaxLength(256)
  assignmentTitle?: string;

  @ApiPropertyOptional({ description: '作业说明（可选）' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ description: '截止时间 ISO 字符串（可选）' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  deadline?: string;

  @ApiPropertyOptional({ description: '置信度（可选）' })
  @IsOptional()
  confidence?: number;
}
