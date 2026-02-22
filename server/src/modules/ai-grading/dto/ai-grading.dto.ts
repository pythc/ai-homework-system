import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AssignmentAiGradingStrictness } from '../../assignment/entities/assignment.entity';

export class ModelHintDto {
  @ApiPropertyOptional({ description: 'Model name override.' })
  name?: string;

  @ApiPropertyOptional({ description: 'Model version hint.' })
  version?: string;
}

export class AiRunOptionsDto {
  @ApiPropertyOptional({ description: 'Max pages/images fed to model.' })
  maxPages?: number;

  @ApiPropertyOptional({ description: 'PDF render DPI.' })
  imageDpi?: number;

  @ApiPropertyOptional({
    description: 'Include student markdown in output.',
  })
  returnStudentMarkdown?: boolean;

  @ApiPropertyOptional({ description: 'Sampling temperature.' })
  temperature?: number;

  @ApiPropertyOptional({
    description: 'Enable handwriting-focused grading prompt.',
  })
  handwritingRecognition?: boolean;

  @ApiPropertyOptional({
    enum: AssignmentAiGradingStrictness,
    description: 'Grading strictness level.',
  })
  gradingStrictness?: AssignmentAiGradingStrictness;

  @ApiPropertyOptional({
    description: 'Teacher custom grading guidance text.',
  })
  customGuidance?: string;
}

export class UncertaintyPolicyDto {
  @ApiPropertyOptional({
    description: 'Force uncertain if confidence is below this value.',
  })
  minConfidence?: number;
}

export class AiRunRequestDto {
  @ApiProperty({
    enum: ['LATEST_PUBLISHED', 'SPECIFIC'],
  })
  snapshotPolicy!: 'LATEST_PUBLISHED' | 'SPECIFIC';

  @ApiPropertyOptional({
    description: 'Required when snapshotPolicy=SPECIFIC.',
  })
  assignmentSnapshotId?: string;

  @ApiPropertyOptional({ type: ModelHintDto })
  modelHint?: ModelHintDto;

  @ApiPropertyOptional({ type: AiRunOptionsDto })
  options?: AiRunOptionsDto;

  @ApiPropertyOptional({ type: UncertaintyPolicyDto })
  uncertaintyPolicy?: UncertaintyPolicyDto;
}

export class AiJobSummaryDto {
  @ApiProperty()
  aiJobId!: string;

  @ApiProperty()
  submissionVersionId!: string;

  @ApiProperty({
    enum: ['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED'],
  })
  status!: string;

  @ApiProperty()
  createdAt!: string;
}

export class AiJobAcceptedResponseDto {
  @ApiProperty({ type: AiJobSummaryDto })
  job!: AiJobSummaryDto;
}

export class AiJobProgressDto {
  @ApiProperty({
    enum: ['PREPARE_INPUT', 'CALL_MODEL', 'PARSE_OUTPUT', 'SAVE_RESULT'],
  })
  stage!: string;
}

export class AiJobStatusResponseDto {
  @ApiProperty()
  aiJobId!: string;

  @ApiProperty({
    enum: ['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED'],
  })
  status!: string;

  @ApiPropertyOptional({ type: AiJobProgressDto })
  progress?: AiJobProgressDto;

  @ApiPropertyOptional()
  error?: string | null;

  @ApiProperty()
  updatedAt!: string;
}

export class AiUncertaintyReasonDto {
  @ApiProperty({
    enum: [
      'UNREADABLE',
      'JUMP_STEP',
      'STEP_CONFLICT',
      'FINAL_ANSWER_MISMATCH',
      'MISSING_INFO',
      'FORMAT_AMBIGUOUS',
      'LOW_CONFIDENCE',
      'NON_HANDWRITTEN',
    ],
  })
  code!: string;

  @ApiProperty()
  message!: string;

  @ApiPropertyOptional()
  questionIndex?: number;
}

export class AiItemResultDto {
  @ApiProperty()
  questionIndex!: number;

  @ApiProperty()
  rubricItemKey!: string;

  @ApiProperty()
  score!: number;

  @ApiProperty()
  maxScore!: number;

  @ApiProperty()
  reason!: string;

  @ApiProperty()
  uncertaintyScore!: number;
}

export class AiResultDto {
  @ApiProperty()
  comment!: string;

  @ApiProperty()
  confidence!: number;

  @ApiProperty()
  isUncertain!: boolean;

  @ApiProperty({ type: [AiUncertaintyReasonDto] })
  uncertaintyReasons!: AiUncertaintyReasonDto[];

  @ApiProperty({ type: [AiItemResultDto] })
  items!: AiItemResultDto[];

  @ApiProperty()
  totalScore!: number;
}

export class AiExtractedDto {
  @ApiPropertyOptional()
  studentMarkdown?: string;
}

export class ModelInfoDto {
  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  version?: string;
}

export class AiGradingResponseDto {
  @ApiProperty()
  aiGradingId!: string;

  @ApiProperty()
  submissionVersionId!: string;

  @ApiProperty()
  assignmentSnapshotId!: string;

  @ApiProperty({ type: ModelInfoDto })
  model!: ModelInfoDto;

  @ApiProperty({ type: AiResultDto })
  result!: AiResultDto;

  @ApiPropertyOptional({ type: AiExtractedDto })
  extracted?: AiExtractedDto;

  @ApiProperty()
  createdAt!: string;
}

export class ErrorResponseDto {
  @ApiProperty()
  error!: string;
}
