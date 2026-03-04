import { IsOptional, Matches } from 'class-validator';

export class BillingUsageQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-\d{2}$/, { message: 'period 格式应为 YYYY-MM' })
  period?: string;
}
