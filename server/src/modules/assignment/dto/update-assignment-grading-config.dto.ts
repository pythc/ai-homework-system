import { Type } from 'class-transformer';
import {
  Max,
  Min,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { AssignmentAiGradingStrictness } from '../entities/assignment.entity';

class AssignmentWeightUpdateDto {
  @IsUUID()
  questionId!: string;

  @IsNumber()
  weight!: number;
}

export class UpdateAssignmentGradingConfigDto {
  @IsOptional()
  @IsString()
  deadline?: string;

  @IsOptional()
  @IsNumber()
  totalScore?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssignmentWeightUpdateDto)
  questionWeights?: AssignmentWeightUpdateDto[];

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
  aiEnabled?: boolean;

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
}
