import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { BillingPlanCode, BillingPlanEntity } from './entities/billing-plan.entity';
import {
  BillingSubscriptionStatus,
  SchoolSubscriptionEntity,
} from './entities/school-subscription.entity';
import { BillingUsageEntity, BillingUsageMetric } from './entities/billing-usage.entity';
import { UpsertSchoolSubscriptionDto } from './dto/upsert-school-subscription.dto';

type PlanPreset = {
  name: string;
  aiGradingMonthlyQuota: number | null;
  assistantChatMonthlyQuota: number | null;
  features: Record<string, unknown>;
};

const PLAN_PRESETS: Record<BillingPlanCode, PlanPreset> = {
  [BillingPlanCode.FREE]: {
    name: '免费版',
    aiGradingMonthlyQuota: 300,
    assistantChatMonthlyQuota: 500,
    features: {
      privateDeployment: false,
      brandCustomization: false,
      supportLevel: 'community',
    },
  },
  [BillingPlanCode.PLUS]: {
    name: 'Plus（院系版）',
    aiGradingMonthlyQuota: 10000,
    assistantChatMonthlyQuota: 30000,
    features: {
      privateDeployment: false,
      brandCustomization: false,
      supportLevel: 'ticket',
    },
  },
  [BillingPlanCode.PRO]: {
    name: 'Pro（学校版）',
    aiGradingMonthlyQuota: null,
    assistantChatMonthlyQuota: null,
    features: {
      privateDeployment: true,
      brandCustomization: true,
      supportLevel: 'project',
    },
  },
};

export class BillingQuotaExceededError extends ForbiddenException {
  constructor(
    readonly metric: BillingUsageMetric,
    readonly planCode: BillingPlanCode,
    readonly quota: number,
  ) {
    super(
      metric === BillingUsageMetric.AI_GRADING_JOBS
        ? `当前套餐（${planCode}）AI 批改额度已用尽（${quota}/月）`
        : `当前套餐（${planCode}）AI 助手额度已用尽（${quota}/月）`,
    );
  }
}

@Injectable()
export class BillingService implements OnModuleInit {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    @InjectRepository(BillingPlanEntity)
    private readonly planRepo: Repository<BillingPlanEntity>,
    @InjectRepository(SchoolSubscriptionEntity)
    private readonly subscriptionRepo: Repository<SchoolSubscriptionEntity>,
    @InjectRepository(BillingUsageEntity)
    private readonly usageRepo: Repository<BillingUsageEntity>,
  ) {}

  async onModuleInit() {
    await this.ensurePlanPresets();
  }

  async listPlans() {
    const plans = await this.planRepo.find({ order: { code: 'ASC' } });
    if (plans.length > 0) {
      return plans.map((plan) => this.serializePlan(plan));
    }

    return Object.entries(PLAN_PRESETS).map(([code, preset]) => ({
      code: code as BillingPlanCode,
      name: preset.name,
      quotas: {
        aiGradingMonthlyQuota: preset.aiGradingMonthlyQuota,
        assistantChatMonthlyQuota: preset.assistantChatMonthlyQuota,
      },
      features: preset.features,
    }));
  }

  async getSchoolOverview(schoolIdInput: string, period?: string) {
    const schoolId = this.normalizeSchoolId(schoolIdInput);
    const periodStart = this.resolvePeriodStart(period);
    const { plan, planCode, subscription } = await this.resolveEffectivePlan(schoolId);
    const usage = await this.getUsageMap(schoolId, periodStart);

    const aiQuota = this.readQuota(plan, BillingUsageMetric.AI_GRADING_JOBS);
    const assistantQuota = this.readQuota(plan, BillingUsageMetric.ASSISTANT_CHAT_TURNS);
    const aiUsed = usage[BillingUsageMetric.AI_GRADING_JOBS] ?? 0;
    const assistantUsed = usage[BillingUsageMetric.ASSISTANT_CHAT_TURNS] ?? 0;

    return {
      schoolId,
      subscription: {
        planCode,
        planName: plan?.name ?? PLAN_PRESETS[planCode].name,
        status: subscription?.status ?? BillingSubscriptionStatus.ACTIVE,
        startsAt: subscription?.startsAt ?? null,
        endsAt: subscription?.endsAt ?? null,
      },
      period: periodStart.slice(0, 7),
      usage: {
        aiGradingJobs: aiUsed,
        assistantChatTurns: assistantUsed,
      },
      quotas: {
        aiGradingMonthlyQuota: aiQuota,
        assistantChatMonthlyQuota: assistantQuota,
      },
      remaining: {
        aiGradingJobs: aiQuota === null ? null : Math.max(aiQuota - aiUsed, 0),
        assistantChatTurns:
          assistantQuota === null ? null : Math.max(assistantQuota - assistantUsed, 0),
      },
      metadata: {
        notes: subscription?.notes ?? null,
        extra: subscription?.metadata ?? {},
      },
    };
  }

  async upsertSchoolSubscription(
    schoolIdInput: string,
    dto: UpsertSchoolSubscriptionDto,
    operatorUserId?: string,
  ) {
    const schoolId = this.normalizeSchoolId(schoolIdInput);
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : new Date();
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    if (endsAt && endsAt.getTime() <= startsAt.getTime()) {
      throw new BadRequestException('订阅结束时间必须晚于开始时间');
    }

    await this.assertPlanExists(dto.planCode);

    const existing = await this.subscriptionRepo.findOne({ where: { schoolId } });
    if (existing) {
      existing.planCode = dto.planCode;
      existing.status = dto.status ?? BillingSubscriptionStatus.ACTIVE;
      existing.startsAt = startsAt;
      existing.endsAt = endsAt;
      existing.notes = dto.notes ?? null;
      existing.metadata = dto.metadata ?? {};
      existing.activatedByUserId = operatorUserId ?? existing.activatedByUserId;
      existing.updatedAt = new Date();
      await this.subscriptionRepo.save(existing);
    } else {
      const created = this.subscriptionRepo.create({
        schoolId,
        planCode: dto.planCode,
        status: dto.status ?? BillingSubscriptionStatus.ACTIVE,
        startsAt,
        endsAt,
        notes: dto.notes ?? null,
        metadata: dto.metadata ?? {},
        activatedByUserId: operatorUserId ?? null,
      });
      await this.subscriptionRepo.save(created);
    }

    return this.getSchoolOverview(schoolId);
  }

  async consumeUsage(
    schoolIdInput: string,
    metric: BillingUsageMetric,
    amount = 1,
    period?: string,
  ) {
    const schoolId = this.normalizeSchoolId(schoolIdInput);
    const normalizedAmount = this.normalizeAmount(amount);
    const periodStart = this.resolvePeriodStart(period);
    const { plan, planCode } = await this.resolveEffectivePlan(schoolId);
    const quota = this.readQuota(plan, metric);
    const usedCount = await this.incrementUsage({
      schoolId,
      periodStart,
      metric,
      amount: normalizedAmount,
      quota,
      planCode,
    });

    return {
      schoolId,
      period: periodStart.slice(0, 7),
      metric,
      planCode,
      quota,
      used: usedCount,
      remaining: quota === null ? null : Math.max(quota - usedCount, 0),
    };
  }

  async releaseUsage(
    schoolIdInput: string,
    metric: BillingUsageMetric,
    amount = 1,
    period?: string,
  ) {
    const schoolId = this.normalizeSchoolId(schoolIdInput);
    const normalizedAmount = this.normalizeAmount(amount);
    const periodStart = this.resolvePeriodStart(period);
    await this.usageRepo.query(
      `UPDATE billing_usage
       SET used_count = GREATEST(used_count - $4, 0),
           updated_at = now()
       WHERE school_id = $1
         AND period_start = $2
         AND metric = $3`,
      [schoolId, periodStart, metric, normalizedAmount],
    );
  }

  private async ensurePlanPresets() {
    try {
      await this.planRepo.upsert(
        Object.entries(PLAN_PRESETS).map(([code, preset]) => ({
          code: code as BillingPlanCode,
          name: preset.name,
          aiGradingMonthlyQuota: preset.aiGradingMonthlyQuota,
          assistantChatMonthlyQuota: preset.assistantChatMonthlyQuota,
          features: preset.features,
        })),
        ['code'],
      );
    } catch (error) {
      if (error instanceof QueryFailedError) {
        this.logger.warn(
          'Billing tables are not ready. Run migrations to enable subscription control.',
        );
        return;
      }
      throw error;
    }
  }

  private async assertPlanExists(code: BillingPlanCode) {
    const plan = await this.planRepo.findOne({ where: { code } });
    if (plan) return;
    if (PLAN_PRESETS[code]) return;
    throw new BadRequestException(`套餐不存在: ${code}`);
  }

  private async resolveEffectivePlan(schoolId: string) {
    let subscription = await this.subscriptionRepo.findOne({ where: { schoolId } });
    if (!subscription) {
      subscription = this.subscriptionRepo.create({
        schoolId,
        planCode: BillingPlanCode.FREE,
        status: BillingSubscriptionStatus.ACTIVE,
        startsAt: new Date(),
        endsAt: null,
        metadata: {},
      });
      subscription = await this.subscriptionRepo.save(subscription);
    }

    const now = Date.now();
    const isActive =
      subscription.status === BillingSubscriptionStatus.ACTIVE &&
      (!subscription.endsAt || subscription.endsAt.getTime() > now);
    const planCode = isActive ? subscription.planCode : BillingPlanCode.FREE;
    const plan = await this.planRepo.findOne({ where: { code: planCode } });
    return { subscription, planCode, plan };
  }

  private resolvePeriodStart(period?: string) {
    if (period) {
      if (!/^\d{4}-\d{2}$/.test(period)) {
        throw new BadRequestException('period 格式应为 YYYY-MM');
      }
      const [yearRaw, monthRaw] = period.split('-');
      const year = Number(yearRaw);
      const month = Number(monthRaw);
      if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
        throw new BadRequestException('period 参数无效');
      }
      return `${yearRaw}-${monthRaw}-01`;
    }
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  }

  private normalizeSchoolId(value: string) {
    const schoolId = String(value ?? '').trim();
    if (!schoolId) {
      throw new BadRequestException('缺少 schoolId');
    }
    return schoolId;
  }

  private normalizeAmount(value: number) {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('额度扣减数量必须大于 0');
    }
    return Math.floor(amount);
  }

  private readQuota(
    plan: BillingPlanEntity | null,
    metric: BillingUsageMetric,
  ): number | null {
    if (plan) {
      return metric === BillingUsageMetric.AI_GRADING_JOBS
        ? plan.aiGradingMonthlyQuota
        : plan.assistantChatMonthlyQuota;
    }

    const fallback = PLAN_PRESETS[BillingPlanCode.FREE];
    return metric === BillingUsageMetric.AI_GRADING_JOBS
      ? fallback.aiGradingMonthlyQuota
      : fallback.assistantChatMonthlyQuota;
  }

  private async getUsageMap(schoolId: string, periodStart: string) {
    const rows = await this.usageRepo.find({
      where: { schoolId, periodStart },
    });
    const map: Partial<Record<BillingUsageMetric, number>> = {};
    for (const row of rows) {
      map[row.metric] = Number(row.usedCount ?? 0);
    }
    return map;
  }

  private async incrementUsage(params: {
    schoolId: string;
    periodStart: string;
    metric: BillingUsageMetric;
    amount: number;
    quota: number | null;
    planCode: BillingPlanCode;
  }) {
    const { schoolId, periodStart, metric, amount, quota, planCode } = params;
    if (quota !== null && quota <= 0) {
      throw new BillingQuotaExceededError(metric, planCode, quota);
    }

    const limited = Number.isFinite(quota as number);
    const sql = limited
      ? `INSERT INTO billing_usage
           (school_id, period_start, metric, used_count, created_at, updated_at)
         VALUES ($1, $2, $3, $4, now(), now())
         ON CONFLICT (school_id, period_start, metric)
         DO UPDATE SET
           used_count = billing_usage.used_count + EXCLUDED.used_count,
           updated_at = now()
         WHERE billing_usage.used_count + EXCLUDED.used_count <= $5
         RETURNING used_count`
      : `INSERT INTO billing_usage
           (school_id, period_start, metric, used_count, created_at, updated_at)
         VALUES ($1, $2, $3, $4, now(), now())
         ON CONFLICT (school_id, period_start, metric)
         DO UPDATE SET
           used_count = billing_usage.used_count + EXCLUDED.used_count,
           updated_at = now()
         RETURNING used_count`;

    const values = limited
      ? [schoolId, periodStart, metric, amount, quota]
      : [schoolId, periodStart, metric, amount];
    const rows = await this.usageRepo.query(sql, values);
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new BillingQuotaExceededError(metric, planCode, Number(quota ?? 0));
    }
    return Number(rows[0]?.used_count ?? 0);
  }

  private serializePlan(plan: BillingPlanEntity) {
    return {
      code: plan.code,
      name: plan.name,
      quotas: {
        aiGradingMonthlyQuota: plan.aiGradingMonthlyQuota,
        assistantChatMonthlyQuota: plan.assistantChatMonthlyQuota,
      },
      features: plan.features ?? {},
    };
  }
}
