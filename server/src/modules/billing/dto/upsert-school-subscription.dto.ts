import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { BillingPlanCode } from '../entities/billing-plan.entity';
import { BillingSubscriptionStatus } from '../entities/school-subscription.entity';

export class UpsertSchoolSubscriptionDto {
  @IsEnum(BillingPlanCode)
  planCode!: BillingPlanCode;

  @IsOptional()
  @IsEnum(BillingSubscriptionStatus)
  status?: BillingSubscriptionStatus;

  @IsOptional()
  @IsDateString()
  startsAt?: string;

  @IsOptional()
  @IsDateString()
  endsAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsObject()
  @Type(() => Object)
  metadata?: Record<string, unknown>;
}
