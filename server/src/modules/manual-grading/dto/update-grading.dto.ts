import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum GradingSource {
  MANUAL = 'MANUAL',
  AI_ADOPTED = 'AI_ADOPTED',
  MIXED = 'MIXED',
}

export class UpdateGradingItemDto {
  @IsInt()
  @Min(1)
  questionIndex!: number;

  @IsString()
  rubricItemKey!: string;

  @IsNumber()
  @Min(0)
  score!: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class UpdateGradingDto {
  @IsEnum(GradingSource)
  source!: GradingSource;

  @IsNumber()
  @Min(0)
  totalScore!: number;

  @IsOptional()
  @IsString()
  finalComment?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpdateGradingItemDto)
  items!: UpdateGradingItemDto[];
}
