import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { BillingPlanEntity } from './entities/billing-plan.entity';
import { SchoolSubscriptionEntity } from './entities/school-subscription.entity';
import { BillingUsageEntity } from './entities/billing-usage.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      BillingPlanEntity,
      SchoolSubscriptionEntity,
      BillingUsageEntity,
    ]),
  ],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
