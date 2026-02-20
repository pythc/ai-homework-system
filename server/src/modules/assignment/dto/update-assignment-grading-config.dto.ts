import { Type } from 'class-transformer';
import {
  Max,
  Min,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

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
  @IsNumber()
  @Min(0)
  @Max(1)
  aiConfidenceThreshold?: number;
}
