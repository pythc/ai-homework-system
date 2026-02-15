import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class AssistantImageDto {
  @ApiProperty({ description: '图片文件名' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ description: '图片 dataUrl（base64）' })
  @IsOptional()
  @IsString()
  dataUrl?: string;

  @ApiPropertyOptional({ description: '图片URL（上传后地址）' })
  @IsOptional()
  @IsString()
  url?: string;
}

export class AssistantChatDto {
  @ApiProperty({ description: '用户问题', example: '这门课平均分是多少？' })
  @IsString()
  @MaxLength(4000)
  question!: string;

  @ApiPropertyOptional({ description: '课程ID（可选）' })
  @IsOptional()
  @IsUUID()
  courseId?: string;

  @ApiPropertyOptional({ description: '作业ID（可选）' })
  @IsOptional()
  @IsUUID()
  assignmentId?: string;

  @ApiPropertyOptional({ description: '会话ID（可选，用于上下文缓存）' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  sessionId?: string;

  @ApiPropertyOptional({
    description: '深度思考模式（auto/enabled/disabled）',
    enum: ['auto', 'enabled', 'disabled'],
  })
  @IsOptional()
  @IsIn(['auto', 'enabled', 'disabled'])
  thinking?: 'auto' | 'enabled' | 'disabled';

  @ApiPropertyOptional({ description: '图片列表（base64 dataUrl）' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssistantImageDto)
  images?: AssistantImageDto[];
}
