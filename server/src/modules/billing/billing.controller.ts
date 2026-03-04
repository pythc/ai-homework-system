import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Query,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';
import { UpsertSchoolSubscriptionDto } from './dto/upsert-school-subscription.dto';
import { BillingUsageQueryDto } from './dto/billing-usage-query.dto';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('plans')
  @UseGuards(JwtAuthGuard)
  async listPlans() {
    return { plans: await this.billingService.listPlans() };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMyBilling(
    @Req() req: { user?: { sub?: string; schoolId?: string; role?: UserRole } },
    @Query() query: BillingUsageQueryDto,
  ) {
    const schoolId = String(req.user?.schoolId ?? '').trim();
    return this.billingService.getSchoolOverview(schoolId, query.period);
  }

  @Get('schools/:schoolId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getSchoolBilling(
    @Param('schoolId') schoolId: string,
    @Req() req: { user?: { schoolId?: string } },
    @Query() query: BillingUsageQueryDto,
  ) {
    this.assertSchoolAccess(schoolId, req.user?.schoolId);
    return this.billingService.getSchoolOverview(schoolId, query.period);
  }

  @Put('schools/:schoolId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async upsertSchoolSubscription(
    @Param('schoolId') schoolId: string,
    @Body() dto: UpsertSchoolSubscriptionDto,
    @Req() req: { user?: { sub?: string; schoolId?: string } },
  ) {
    this.assertSchoolAccess(schoolId, req.user?.schoolId);
    return this.billingService.upsertSchoolSubscription(
      schoolId,
      dto,
      req.user?.sub,
    );
  }

  private assertSchoolAccess(targetSchoolId: string, currentSchoolId?: string) {
    if (!targetSchoolId) {
      throw new ForbiddenException('无权访问该学校订阅信息');
    }
    if (targetSchoolId !== currentSchoolId) {
      throw new ForbiddenException('无权访问该学校订阅信息');
    }
  }
}
