import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class AssistantStatsDto {
  @ApiPropertyOptional({ description: '课程ID（可选）' })
  @IsOptional()
  @IsUUID()
  courseId?: string;

  @ApiPropertyOptional({ description: '作业ID（可选）' })
  @IsOptional()
  @IsUUID()
  assignmentId?: string;
}
