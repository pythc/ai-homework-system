import { Type } from 'class-transformer';
import {
  Max,
  Min,
  IsBoolean,
  IsEnum,
  MaxLength,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { AssignmentAiGradingStrictness } from '../../assignment/entities/assignment.entity';

export enum SnapshotPolicy {
  LATEST_PUBLISHED = 'LATEST_PUBLISHED',
  SPECIFIC = 'SPECIFIC',
}

export class ModelHintDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  version?: string;
}

export class AiRunOptionsDto {
  /** PDF / 多图最多喂给模型的页数上限 */
  @IsOptional()
  @IsNumber()
  maxPages?: number;

  /** PDF 转图的 DPI */
  @IsOptional()
  @IsNumber()
  imageDpi?: number;

  /** 是否让模型额外输出 studentMarkdown */
  @IsOptional()
  @IsBoolean()
  returnStudentMarkdown?: boolean;

  /** 建议 0，降低波动 */
  @IsOptional()
  @IsNumber()
  temperature?: number;

  /** 启用手写识别模式（提示词将切换为手写版） */
  @IsOptional()
  @IsBoolean()
  handwritingRecognition?: boolean;

  /** 批改严厉程度：宽松 / 均衡 / 严格 */
  @IsOptional()
  @IsEnum(AssignmentAiGradingStrictness)
  gradingStrictness?: AssignmentAiGradingStrictness;

  /** 教师附加的批改方向提示词 */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  customGuidance?: string;
}

export class UncertaintyPolicyDto {
  /** 如果模型给的 confidence < 阈值，则后端强制 isUncertain=true 并追加原因 */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  minConfidence?: number;
}

export class TriggerAiGradingDto {
  /**
   * 快照策略
   * - LATEST_PUBLISHED：取该作业最新已发布快照
   * - SPECIFIC：指定 assignmentSnapshotId
   */
  @IsEnum(SnapshotPolicy)
  snapshotPolicy!: SnapshotPolicy;
  
  /**
   * 当 snapshotPolicy=SPECIFIC 时必填
   */
  @ValidateIf((dto) => dto.snapshotPolicy === SnapshotPolicy.SPECIFIC)
  @IsUUID()
  assignmentSnapshotId?: string;

  /**
   * 模型提示信息
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => ModelHintDto)
  modelHint?: ModelHintDto;

  /**
   * 批改选项
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => AiRunOptionsDto)
  options?: AiRunOptionsDto;

  /**
   * 不确定性策略
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => UncertaintyPolicyDto)
  uncertaintyPolicy?: UncertaintyPolicyDto;
}
