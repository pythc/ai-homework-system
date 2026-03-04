<template>
  <TeacherLayout
    title="订阅套餐"
    subtitle="先选档位，再看全部对比细则"
    :profile-name="profileName"
    :profile-account="profileAccount"
    brand-sub="商业与部署"
  >
    <section class="pricing-shell">
      <section class="plans-grid">
        <article
          v-for="plan in plans"
          :key="plan.id"
          class="plan-card glass"
          :class="{ recommended: plan.recommended, focused: focusedPlanId === plan.id }"
        >
          <header class="plan-head">
            <div class="plan-title-wrap">
              <h3 class="plan-title">{{ plan.planTitle }}</h3>
              <p class="plan-subtitle">{{ plan.planSubtitle }}</p>
            </div>
            <span v-if="plan.badge" class="plan-badge">{{ plan.badge }}</span>
          </header>

          <div class="plan-price">
            <template v-if="plan.price.kind === 'fixed'">
              <div class="price-main">
                <span class="price-value">{{ plan.price.current }}</span>
                <span class="price-currency">{{ plan.price.currency }}</span>
                <span class="price-unit">{{ plan.price.unit }}</span>
              </div>
              <div class="price-note">{{ plan.price.note }}</div>
              <div v-if="plan.price.original !== null" class="price-original">
                原价 {{ plan.price.original }}{{ plan.price.currency }}{{ plan.price.unit }}
              </div>
            </template>
            <template v-else>
              <div class="quote-main">联系销售获取报价</div>
              <div class="price-note">{{ plan.price.note }}</div>
              <div class="quote-points">
                <span>按规模报价（席位/活跃学生/包量）</span>
                <span>支持学校级采购与项目交付</span>
              </div>
            </template>
          </div>

          <button
            type="button"
            class="plan-cta"
            :class="{ primary: plan.recommended, ghost: !plan.recommended }"
            @click="handlePlanCta(plan)"
          >
            {{ plan.ctaLabel }}
          </button>

          <section class="decision-block">
            <div class="section-title">主要差异</div>
            <ul class="decision-list">
              <li
                v-for="item in plan.decisionPoints.slice(0, 4)"
                :key="item.text"
                class="decision-item"
                :class="{ disabled: !item.enabled }"
              >
                <font-awesome-icon
                  v-if="item.enabled"
                  icon="fal fa-badge-check"
                  class="decision-icon"
                />
                <span v-else class="decision-mark">—</span>
                <span class="decision-text">{{ item.text }}</span>
              </li>
            </ul>
          </section>

          <section class="quota-block">
            <div class="section-title">关键配额</div>
            <div class="quota-list">
              <span v-for="quota in plan.keyQuotas" :key="quota" class="quota-pill">{{ quota }}</span>
            </div>
          </section>

          <button type="button" class="compare-link" @click="openCompare(plan.id)">
            查看全部功能对比 →
          </button>
        </article>
      </section>

      <section class="faq-block glass">
        <div class="faq-title">FAQ / 计费说明</div>
        <details class="faq-item" open>
          <summary>活跃学生如何计算？</summary>
          <p>当月在任一课程中有“查看作业 / 提交作业 / 查看成绩”行为的唯一学生数。</p>
        </details>
        <details class="faq-item">
          <summary>AI 批改次数如何计算？</summary>
          <p>一次提交触发一次 AI 批改 job；默认重试不重复计费。</p>
        </details>
        <details class="faq-item">
          <summary>可选/项目制是什么意思？</summary>
          <p>该能力需要私有化交付或二次集成，不在开源自助部署默认范围内。</p>
        </details>
        <details class="faq-item">
          <summary>/metrics 能关闭吗？</summary>
          <p>可通过 <code>ENABLE_METRICS=false</code> 关闭服务侧指标暴露。</p>
        </details>
      </section>
    </section>

    <div v-if="compareOpen" class="compare-mask" @click.self="compareOpen = false">
      <section class="compare-drawer glass">
        <header class="compare-header">
          <div>
            <h3>全部功能对比</h3>
            <p>按“核心平台 / AI / 运维治理”查看三档差异。</p>
          </div>
          <button type="button" class="close-btn" @click="compareOpen = false">关闭</button>
        </header>

        <div class="compare-scroll">
          <section v-for="group in comparisonGroups" :key="group.title" class="compare-group">
            <h4>{{ group.title }}</h4>
            <table class="compare-table">
              <thead>
                <tr>
                  <th>能力项</th>
                  <th>Free</th>
                  <th>Plus</th>
                  <th>Pro</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in group.rows" :key="row.label">
                  <td class="feature-col">{{ row.label }}</td>
                  <td v-for="planId in planColumns" :key="`${row.label}-${planId}`" class="value-col">
                    <font-awesome-icon
                      v-if="row[planId].enabled"
                      icon="fal fa-badge-check"
                      class="value-icon"
                    />
                    <span v-else class="value-mark off">—</span>
                    <span class="value-text">{{ row[planId].text || (row[planId].enabled ? '支持' : '不支持') }}</span>
                    <span v-if="row[planId].tag" class="value-tag">{{ row[planId].tag }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </section>
        </div>
      </section>
    </div>

    <div v-if="confirmMailOpen" class="confirm-mask" @click.self="closeMailConfirm">
      <section class="confirm-card glass">
        <h3 class="confirm-title">即将跳转至邮箱</h3>
        <p class="confirm-desc">将打开默认邮箱客户端联系销售，是否继续？</p>
        <div class="confirm-actions">
          <button type="button" class="confirm-btn ghost" @click="closeMailConfirm">取消</button>
          <button type="button" class="confirm-btn primary" @click="confirmMailJump">确定</button>
        </div>
      </section>
    </div>
  </TeacherLayout>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { library } from '@fortawesome/fontawesome-svg-core'
import { faCircleCheck } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import TeacherLayout from '../components/TeacherLayout.vue'
import { useTeacherProfile } from '../composables/useTeacherProfile'

type PlanId = 'free' | 'plus' | 'pro'

type DecisionItem = {
  text: string
  enabled: boolean
}

type FixedPrice = {
  kind: 'fixed'
  currency: string
  current: number
  original: number | null
  unit: string
  note: string
}

type QuotePrice = {
  kind: 'quote'
  note: string
}

type PlanConfig = {
  id: PlanId
  planTitle: string
  planSubtitle: string
  badge: string | null
  recommended: boolean
  ctaLabel: string
  decisionPoints: DecisionItem[]
  keyQuotas: string[]
  price: FixedPrice | QuotePrice
}

type CompareCell = {
  enabled: boolean
  text?: string
  tag?: string
}

type CompareRow = {
  label: string
  free: CompareCell
  plus: CompareCell
  pro: CompareCell
}

const faBadgeCheckLight = {
  ...faCircleCheck,
  prefix: 'fal',
  iconName: 'badge-check',
}
library.add(faBadgeCheckLight as any)

const { profileName, profileAccount, refreshProfile } = useTeacherProfile()

const compareOpen = ref(false)
const confirmMailOpen = ref(false)
const focusedPlanId = ref<PlanId>('plus')
const currentPlanId = ref<PlanId>('free')
const planColumns: PlanId[] = ['free', 'plus', 'pro']

const plans: PlanConfig[] = [
  {
    id: 'free',
    planTitle: '免费版',
    planSubtitle: '小班试点与个人教师，跑通作业闭环',
    badge: null,
    recommended: false,
    ctaLabel: '开始使用',
    decisionPoints: [
      { text: '作业全流程闭环', enabled: true },
      { text: '学生端文字 + 图片提交', enabled: true },
      { text: 'AI 先批 + 教师复核', enabled: true },
      { text: '题库治理（教材-章节-题目）', enabled: true },
      { text: '品牌定制（学校名称/登录页）', enabled: false },
    ],
    keyQuotas: ['AI 批改 300 次/月', 'AI 对话 500 轮/月'],
    price: {
      kind: 'fixed',
      currency: '¥',
      current: 0,
      original: null,
      unit: '',
      note: '永久免费（自助部署 / 社区支持）',
    },
  },
  {
    id: 'plus',
    planTitle: 'Plus（院系版）',
    planSubtitle: '小规模正式使用，提升批改吞吐与教学运营效率',
    badge: '推荐 · 最高性价比',
    recommended: true,
    ctaLabel: '开始使用',
    decisionPoints: [
      { text: '多教师/助教协作（同课多角色）', enabled: true },
      { text: '作业发布策略完整（题目/权重/截止/可见）', enabled: true },
      { text: '课程成绩矩阵 + 班级名单维护', enabled: true },
      { text: 'Prometheus + Grafana Cloud 标准配置', enabled: true },
      { text: '校内模型/教务系统对接', enabled: false },
    ],
    keyQuotas: ['AI 批改 10,000 次/月', 'AI 对话 30,000 轮/月'],
    price: {
      kind: 'fixed',
      currency: '¥',
      current: 2.5,
      original: 5,
      unit: '/ 活跃学生 / 月',
      note: '按月付费（最低 ¥499/月，含基础 AI 额度）',
    },
  },
  {
    id: 'pro',
    planTitle: 'Pro（学校版）',
    planSubtitle: '私有化与集成，覆盖全校多院系治理与合规要求',
    badge: '学校级部署',
    recommended: false,
    ctaLabel: '联系销售人员',
    decisionPoints: [
      { text: '私有化部署与学校品牌定制', enabled: true },
      { text: '跨院系治理与学校授权范围控制', enabled: true },
      { text: '校内模型/私有模型接入（项目制）', enabled: true },
      { text: 'SSO/SCIM 与教务系统集成（项目制）', enabled: true },
      { text: '开源自助部署默认可得', enabled: false },
    ],
    keyQuotas: ['AI 批改/对话：包量或不限额（合同）', '可观测性/审计/备份恢复：交付项'],
    price: {
      kind: 'quote',
      note: '联系销售以获取定价信息',
    },
  },
]

const comparisonGroups: { title: string; rows: CompareRow[] }[] = [
  {
    title: '核心平台',
    rows: [
      {
        label: '作业全流程闭环（布置→提交→AI先批→教师复核→发布/分析）',
        free: { enabled: true },
        plus: { enabled: true },
        pro: { enabled: true },
      },
      {
        label: '学生端：文字 + 图片提交',
        free: { enabled: true },
        plus: { enabled: true },
        pro: { enabled: true },
      },
      {
        label: '教师端：提交进度/缺交名单/批改状态',
        free: { enabled: true },
        plus: { enabled: true },
        pro: { enabled: true },
      },
      {
        label: '题库体系：教材-章节-题目结构（支持治理）',
        free: { enabled: true },
        plus: { enabled: true },
        pro: { enabled: true },
      },
      {
        label: '多教师/助教协作（同课多角色）',
        free: { enabled: false },
        plus: { enabled: true },
        pro: { enabled: true },
      },
      {
        label: '课程成绩矩阵、班级名单维护',
        free: { enabled: false },
        plus: { enabled: true },
        pro: { enabled: true },
      },
      {
        label: '私有化部署与品牌定制（学校名称/登录页）',
        free: { enabled: false },
        plus: { enabled: false, tag: '项目制' },
        pro: { enabled: true },
      },
      {
        label: '题库可见性按学校授权范围治理',
        free: { enabled: false },
        plus: { enabled: false },
        pro: { enabled: true },
      },
    ],
  },
  {
    title: 'AI 能力',
    rows: [
      {
        label: 'AI 先批（建议评分 + 依据）',
        free: { enabled: true },
        plus: { enabled: true },
        pro: { enabled: true },
      },
      {
        label: 'AI 批改额度',
        free: { enabled: true, text: '300 次/月' },
        plus: { enabled: true, text: '10,000 次/月' },
        pro: { enabled: true, text: '包量/不限额（合同）' },
      },
      {
        label: '学习问答 AI 助手',
        free: { enabled: true, text: '500 轮/月' },
        plus: { enabled: true, text: '30,000 轮/月' },
        pro: { enabled: true, text: '包量/不限额（合同）' },
      },
      {
        label: '教学助手（课程/作业/成绩查询汇总）',
        free: { enabled: false },
        plus: { enabled: true, text: '可选开启' },
        pro: { enabled: true, text: '默认可开' },
      },
      {
        label: '发布后快照留痕可追溯',
        free: { enabled: false },
        plus: { enabled: true },
        pro: { enabled: true },
      },
      {
        label: '校内模型 / 私有模型接入',
        free: { enabled: false },
        plus: { enabled: false, tag: '项目制' },
        pro: { enabled: true, tag: '项目制' },
      },
      {
        label: '批量重批 / 批量导出 / 审计报表',
        free: { enabled: false },
        plus: { enabled: false },
        pro: { enabled: true, tag: '项目制' },
      },
    ],
  },
  {
    title: '运维与治理',
    rows: [
      {
        label: '/metrics 指标暴露',
        free: { enabled: true },
        plus: { enabled: true },
        pro: { enabled: true },
      },
      {
        label: 'Prometheus + Grafana Cloud',
        free: { enabled: false },
        plus: { enabled: true, text: '标准配置' },
        pro: { enabled: true, text: '交付落地', tag: '交付项' },
      },
      {
        label: '指标开关：ENABLE_METRICS=false',
        free: { enabled: true },
        plus: { enabled: true },
        pro: { enabled: true },
      },
      {
        label: '支持方式',
        free: { enabled: false, text: '社区支持' },
        plus: { enabled: true, text: '邮件/工单（工作日）' },
        pro: { enabled: true, text: '学校级专项支持' },
      },
      {
        label: '数据留存策略/备份恢复演练/审计流程',
        free: { enabled: false },
        plus: { enabled: false },
        pro: { enabled: true, tag: '交付项' },
      },
      {
        label: 'SSO/SCIM、教务系统对接',
        free: { enabled: false },
        plus: { enabled: false, tag: '项目制' },
        pro: { enabled: true, tag: '项目制' },
      },
    ],
  },
]

function openCompare(planId: PlanId) {
  focusedPlanId.value = planId
  compareOpen.value = true
}

function focusPlan(planId: PlanId) {
  focusedPlanId.value = planId
  currentPlanId.value = planId
}

function handlePlanCta(plan: PlanConfig) {
  focusPlan(plan.id)
  if (plan.id === 'pro') {
    confirmMailOpen.value = true
  }
}

function closeMailConfirm() {
  confirmMailOpen.value = false
}

function confirmMailJump() {
  confirmMailOpen.value = false
  window.location.href = 'mailto:2813994715@qq.com?subject=AI%20Homework%20Pro%20%E5%AD%A6%E6%A0%A1%E7%89%88%E5%92%A8%E8%AF%A2'
}

onMounted(async () => {
  await refreshProfile()
})
</script>

<style scoped>
.pricing-shell {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.plans-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  align-items: stretch;
}

.plan-card {
  --price-box-height: 146px;
  border: 1px solid rgba(190, 206, 231, 0.72);
  border-radius: 20px;
  box-shadow: 0 6px 20px rgba(37, 61, 105, 0.08);
  padding: 16px;
  display: grid;
  grid-template-rows: auto var(--price-box-height) 48px auto auto auto;
  gap: 12px;
  transition: border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
}

.plan-card.focused {
  border-color: rgba(94, 145, 236, 0.84);
}

.plan-card.recommended {
  transform: none;
  border: 2px solid rgba(79, 133, 230, 0.85);
  background: linear-gradient(180deg, rgba(80, 134, 231, 0.08) 0%, rgba(255, 255, 255, 0.95) 24%);
  box-shadow: 0 10px 24px rgba(79, 131, 220, 0.12);
}

.plan-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.plan-title {
  margin: 0;
  font-size: 36px;
  line-height: 1.15;
  color: #223a67;
}

.plan-subtitle {
  margin: 6px 0 0;
  color: #5d6f8f;
  font-size: 13px;
  line-height: 1.45;
}

.plan-badge {
  flex-shrink: 0;
  border-radius: 999px;
  border: 1px solid rgba(98, 150, 239, 0.46);
  background: rgba(90, 143, 242, 0.14);
  color: #2958b2;
  font-size: 12px;
  font-weight: 700;
  padding: 5px 10px;
}

.plan-price {
  height: var(--price-box-height);
  min-height: var(--price-box-height);
  border-radius: 16px;
  border: 1px solid rgba(204, 218, 239, 0.8);
  background: rgba(247, 251, 255, 0.92);
  padding: 12px;
}

.price-main {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.price-value {
  font-size: 50px;
  line-height: 1;
  color: #203a6c;
  font-weight: 800;
}

.price-currency {
  font-size: 17px;
  color: #20355f;
  font-weight: 700;
}

.price-unit {
  color: #5e7192;
  font-size: 13px;
  font-weight: 600;
}

.price-note {
  margin-top: 7px;
  color: #5d6f8f;
  font-size: 12px;
  line-height: 1.45;
}

.price-original {
  margin-top: 5px;
  color: #8a98b2;
  font-size: 12px;
  text-decoration: line-through;
}

.quote-main {
  color: #1e3765;
  font-size: 25px;
  font-weight: 800;
  line-height: 1.2;
}

.quote-points {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  color: #5e7191;
  font-size: 12px;
}

.plan-cta {
  border-radius: 14px;
  height: 48px;
  font-size: 14px;
  font-weight: 700;
}

.plan-cta.primary {
  border: 0;
  color: #fff;
  background: linear-gradient(90deg, #4f84e6 0%, #5cb6e8 100%);
}

.plan-cta.ghost {
  border: 1px solid rgba(155, 178, 217, 0.78);
  color: #385f9f;
  background: rgba(255, 255, 255, 0.96);
}

.section-title {
  color: #243c68;
  font-size: 13px;
  font-weight: 700;
}

.decision-list {
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.decision-item {
  height: 40px;
  border-bottom: 1px dashed rgba(205, 217, 237, 0.76);
  display: flex;
  align-items: center;
  gap: 8px;
  color: #2d446f;
  font-size: 13px;
}

.decision-item.disabled {
  color: #98a5bc;
}

.decision-icon,
.value-icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.decision-mark {
  width: 18px;
  text-align: center;
  flex-shrink: 0;
}

.decision-text {
  flex: 1;
  min-width: 0;
}

.quota-list {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.quota-pill {
  border-radius: 999px;
  border: 1px solid rgba(155, 180, 220, 0.82);
  background: rgba(236, 243, 255, 0.96);
  color: #315ba9;
  font-size: 12px;
  font-weight: 700;
  padding: 4px 10px;
}

.compare-link {
  margin-top: 2px;
  border: 0;
  background: transparent;
  color: #3561b3;
  font-size: 13px;
  font-weight: 700;
  text-align: left;
  padding: 0;
}

.faq-block {
  border: 1px solid rgba(199, 211, 234, 0.76);
  border-radius: 18px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.faq-title {
  font-size: 15px;
  font-weight: 700;
  color: #223865;
}

.faq-item {
  border: 1px solid rgba(210, 221, 240, 0.88);
  border-radius: 14px;
  padding: 9px 11px;
  background: rgba(249, 252, 255, 0.95);
}

.faq-item summary {
  cursor: pointer;
  color: #29416d;
  font-size: 13px;
  font-weight: 700;
}

.faq-item p {
  margin: 7px 0 0;
  color: #596b89;
  font-size: 13px;
  line-height: 1.5;
}

.faq-item code {
  font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace;
  font-size: 12px;
  border-radius: 6px;
  padding: 1px 4px;
  background: rgba(234, 241, 252, 0.94);
}

.compare-mask {
  position: fixed;
  inset: 0;
  background: rgba(18, 27, 43, 0.38);
  z-index: 60;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 24px;
}

.confirm-mask {
  position: fixed;
  inset: 0;
  background: rgba(18, 27, 43, 0.38);
  z-index: 70;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.confirm-card {
  width: min(420px, 100%);
  border-radius: 18px;
  border: 1px solid rgba(181, 200, 229, 0.9);
  padding: 18px;
}

.confirm-title {
  margin: 0;
  color: #203662;
  font-size: 20px;
}

.confirm-desc {
  margin: 10px 0 0;
  color: #5b6d8d;
  font-size: 14px;
  line-height: 1.5;
}

.confirm-actions {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.confirm-btn {
  height: 38px;
  border-radius: 12px;
  padding: 0 14px;
  font-size: 13px;
  font-weight: 700;
}

.confirm-btn.ghost {
  border: 1px solid rgba(172, 191, 223, 0.82);
  color: #395f9e;
  background: #fff;
}

.confirm-btn.primary {
  border: 0;
  color: #fff;
  background: linear-gradient(90deg, #4f84e6 0%, #5cb6e8 100%);
}

.compare-drawer {
  width: min(1200px, 100%);
  max-height: calc(100vh - 48px);
  border: 1px solid rgba(181, 200, 229, 0.9);
  border-radius: 20px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.compare-header {
  padding: 14px 16px;
  border-bottom: 1px solid rgba(205, 219, 241, 0.82);
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.compare-header h3 {
  margin: 0;
  color: #203662;
  font-size: 20px;
}

.compare-header p {
  margin: 5px 0 0;
  color: #5b6d8d;
  font-size: 13px;
}

.close-btn {
  border: 1px solid rgba(172, 191, 223, 0.82);
  border-radius: 12px;
  background: #fff;
  color: #395f9e;
  height: 36px;
  padding: 0 12px;
  font-size: 13px;
  font-weight: 700;
}

.compare-scroll {
  overflow: auto;
  padding: 12px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.compare-group h4 {
  margin: 0 0 8px;
  color: #223966;
  font-size: 15px;
}

.compare-table {
  width: 100%;
  table-layout: fixed;
  border: 1px solid rgba(196, 211, 235, 0.84);
  border-collapse: separate;
  border-spacing: 0;
  border-radius: 14px;
  overflow: hidden;
  background: rgba(250, 253, 255, 0.96);
}

.compare-table th,
.compare-table td {
  border-bottom: 1px solid rgba(208, 220, 239, 0.86);
  border-right: 1px solid rgba(208, 220, 239, 0.7);
  padding: 10px;
  vertical-align: top;
  text-align: left;
}

.compare-table tr:last-child td {
  border-bottom: 0;
}

.compare-table th:last-child,
.compare-table td:last-child {
  border-right: 0;
}

.compare-table thead th {
  color: #28406e;
  font-size: 13px;
  font-weight: 700;
  background: rgba(238, 245, 255, 0.92);
}

.feature-col {
  width: 28%;
  color: #2d446f;
  font-size: 13px;
  font-weight: 600;
}

.value-col {
  color: #324a76;
  font-size: 12px;
  line-height: 1.45;
}

.value-mark.off {
  color: #9aa6bc;
  margin-right: 6px;
}

.value-tag {
  margin-left: 6px;
  border-radius: 999px;
  border: 1px solid rgba(189, 204, 229, 0.86);
  background: rgba(249, 252, 255, 0.96);
  color: #657794;
  padding: 1px 7px;
  font-size: 11px;
}

.decision-icon,
.value-icon {
  color: #2fb769;
  font-size: 13px;
  line-height: 1;
}

@media (max-width: 1320px) {
  .plans-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .plan-card.recommended {
    transform: none;
  }
}

@media (max-width: 920px) {
  .plans-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
