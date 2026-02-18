import { Type } from 'class-transformer';
import {
  IsArray,
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
}

