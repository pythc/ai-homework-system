import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class FinalGradingItemDto {
  @ApiProperty()
  questionIndex!: number;

  @ApiProperty()
  rubricItemKey!: string;

  @ApiProperty()
  score!: number;

  @ApiProperty()
  reason!: string;
}

export class FinalGradingRequestDto {
  @ApiProperty({
    enum: ['manual', 'AI_ADOPTED', 'MIXED'],
  })
  source!: string;

  @ApiPropertyOptional()
  totalScore?: number;

  @ApiProperty()
  finalComment!: string;

  @ApiProperty({ type: [FinalGradingItemDto] })
  items!: FinalGradingItemDto[];
}

export class FinalGradingResponseDto {
  @ApiProperty()
  gradingId!: string;

  @ApiProperty({ enum: ['GRADED'] })
  status!: string;

  @ApiProperty()
  totalScore!: number;

  @ApiProperty()
  updatedAt!: string;
}
