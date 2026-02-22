import {
  Max,
  Min,
  IsArray,
  IsBoolean,
  IsEnum,
  MaxLength,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  AssignmentAiGradingStrictness,
  AssignmentStatus,
} from '../entities/assignment.entity';
import { QuestionType } from '../entities/assignment-question.entity';

export class CreateAssignmentQuestionDto {
  @IsOptional()
  @IsString()
  questionCode?: string;

  @IsOptional()
  @IsNumber()
  questionIndex?: number;

  @IsOptional()
  @IsString()
  title?: string;

  @IsString()
  @MinLength(1)
  prompt!: string;

  @IsOptional()
  standardAnswer?: unknown;

  @IsOptional()
  @IsEnum(QuestionType)
  questionType?: QuestionType;

  @IsOptional()
  @IsNumber()
  defaultScore?: number;

  @IsOptional()
  rubric?: Record<string, unknown> | Array<Record<string, unknown>>;

  @IsOptional()
  questionSchema?: Record<string, unknown>;

  @IsOptional()
  gradingPolicy?: Record<string, unknown>;
}

export class CreateAssignmentDto {
  @IsUUID()
  courseId!: string;

  @IsOptional()
  @IsNumber()
  questionNo?: number;

  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  deadline?: string;

  @IsOptional()
  @IsNumber()
  totalScore?: number;

  @IsOptional()
  @IsBoolean()
  aiEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  visibleAfterSubmit?: boolean;

  @IsOptional()
  @IsBoolean()
  allowViewAnswer?: boolean;

  @IsOptional()
  @IsBoolean()
  allowViewScore?: boolean;

  @IsOptional()
  @IsBoolean()
  handwritingRecognition?: boolean;

  @IsOptional()
  @IsEnum(AssignmentAiGradingStrictness)
  aiGradingStrictness?: AssignmentAiGradingStrictness;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  aiPromptGuidance?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  aiConfidenceThreshold?: number;

  @IsOptional()
  @IsEnum(AssignmentStatus)
  status?: AssignmentStatus;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  selectedQuestionIds?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAssignmentQuestionDto)
  questions?: CreateAssignmentQuestionDto[];
}
