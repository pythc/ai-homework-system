import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateSubmissionDto {
  @IsUUID()
  courseId!: string;

  @IsUUID()
  assignmentId!: string;

  @IsUUID()
  studentId!: string;

  @IsUUID()
  questionId!: string;

  @IsArray()
  @ArrayMinSize(0)
  @ArrayMaxSize(4)
  @IsString({ each: true })
  @MinLength(1, { each: true })
  fileUrls!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  contentText?: string;

  @IsOptional()
  @IsObject()
  answerPayload?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  answerFormat?: string;
}
