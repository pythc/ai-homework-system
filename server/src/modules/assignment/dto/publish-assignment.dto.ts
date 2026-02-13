import { IsArray, IsNumber, IsOptional, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class AssignmentQuestionWeightDto {
  @IsUUID()
  questionId!: string;

  @IsNumber()
  weight!: number;
}

export class PublishAssignmentDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AssignmentQuestionWeightDto)
  questionWeights?: AssignmentQuestionWeightDto[];
}
