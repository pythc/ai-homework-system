import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  AssignmentAiGradingStrictness,
  AssignmentStatus,
} from '../entities/assignment.entity';

export class UpdateAssignmentDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  deadline?: string;

  @IsOptional()
  @IsEnum(AssignmentStatus)
  status?: AssignmentStatus;

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
  totalScore?: number;
}
