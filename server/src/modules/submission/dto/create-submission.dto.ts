import { ArrayMinSize, IsArray, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateSubmissionDto {
  @IsUUID()
  courseId!: string;

  @IsUUID()
  assignmentId!: string;

  @IsUUID()
  studentId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  fileUrls!: string[];

  @IsOptional()
  @IsString()
  contentText?: string;
}
