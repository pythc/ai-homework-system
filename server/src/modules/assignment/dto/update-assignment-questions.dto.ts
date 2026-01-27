import { ArrayMinSize, IsArray, IsUUID } from 'class-validator';

export class UpdateAssignmentQuestionsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  selectedQuestionIds!: string[];
}
