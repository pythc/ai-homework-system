<template>
  <TeacherLayout
    title="发布作业"
    subtitle="题库选题 + 自定义题混合组卷"
    :profile-name="profileName"
    :profile-account="profileAccount"
    brand-sub="教学面板"
  >
    <template #actions>
      <div class="topbar-profile">
        <div class="topbar-avatar">{{ profileName[0] }}</div>
        <div>
          <div class="topbar-name">{{ profileName }}</div>
          <div class="topbar-id">工号 {{ profileAccount }}</div>
        </div>
      </div>
    </template>

    <section class="panel glass step-panel">
      <div class="panel-title">发布流程</div>
      <div class="stepper">
        <button class="step-item" :class="{ active: step === 1 }" @click="step = 1">
          1. 作业信息
        </button>
        <span class="step-arrow" aria-hidden="true">→</span>
        <button
          class="step-item"
          :class="{ active: step === 2 }"
          :disabled="!canEnterStep2"
          @click="goStep2"
        >
          2. 题目筛选与权重
        </button>
        <span class="step-arrow" aria-hidden="true">→</span>
        <button
          class="step-item"
          :class="{ active: step === 3 }"
          :disabled="!canEnterStep3"
          @click="step = 3"
        >
          3. 发布确认
        </button>
      </div>
    </section>

    <section v-if="step === 1" class="panel glass">
      <div class="panel-title">作业信息</div>
      <div class="form-grid">
        <div class="form-row">
          <div class="form-field">
            <label>选择课程/班级</label>
            <select v-model="selectedCourseId" @change="handleCourseChange">
              <option value="">请选择课程/班级</option>
              <option v-for="course in courses" :key="course.id" :value="course.id">
                {{ course.name }}（{{ course.semester }}）
              </option>
            </select>
          </div>
          <div class="form-field">
            <label>作业标题</label>
            <input v-model="title" type="text" placeholder="例如：第 3 章作业" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-field">
            <label>截止时间</label>
            <input v-model="deadline" type="datetime-local" />
          </div>
          <div class="form-field">
            <label>作业总分</label>
            <input v-model.number="totalScore" type="number" min="1" step="1" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-field ai-assist-group">
            <label class="ai-assist-title">AI 辅助批改</label>
            <div class="ai-assist-grid">
              <div class="ai-assist-card">
                <div class="ai-assist-card-title">基础开关</div>
                <div class="checkbox-stack">
                  <label class="checkbox-item">
                    <input id="ai-enabled" v-model="aiEnabled" type="checkbox" />
                    启用 AI 批改
                  </label>
                  <label class="checkbox-item">
                    <input v-model="handwritingRecognition" type="checkbox" :disabled="!aiEnabled" />
                    启用手写识别
                  </label>
                </div>
              </div>
              <div class="ai-assist-card">
                <div class="ai-assist-card-title">低置信度阈值</div>
                <div class="threshold-input-row">
                  <input
                    v-model.number="aiConfidenceThreshold"
                    type="number"
                    min="0"
                    max="1"
                    step="0.05"
                    :disabled="!aiEnabled"
                  />
                  <span class="helper-text threshold-helper">低于阈值将自动标记为“有异议”</span>
                </div>
              </div>
              <div class="ai-assist-card">
                <div class="ai-assist-card-title">批改严厉程度</div>
                <div class="strictness-grid">
                  <button
                    v-for="option in strictnessOptions"
                    :key="option.value"
                    type="button"
                    class="strictness-pill"
                    :class="{ active: aiGradingStrictness === option.value }"
                    :disabled="!aiEnabled"
                    @click="aiGradingStrictness = option.value"
                  >
                    <span class="strictness-label">{{ option.label }}</span>
                    <span class="strictness-note">{{ option.distribution }}</span>
                  </button>
                </div>
                <span class="helper-text">分布倾向：{{ strictnessDistributionLabel }}</span>
              </div>
              <div class="ai-assist-card">
                <div class="ai-assist-card-title">自定义批改倾向（可选）</div>
                <textarea
                  v-model="aiPromptGuidance"
                  :disabled="!aiEnabled"
                  class="compact-textarea"
                  placeholder="例如：更重视解题步骤完整性，公式书写规范可以酌情加分。"
                />
              </div>
            </div>
          </div>
        </div>
        <div class="form-row">
          <div class="form-field">
            <label>学生端可见性</label>
            <div class="checkbox-stack">
              <label class="checkbox-item">
                <input v-model="visibleAfterSubmit" type="checkbox" />
                学生提交后作业仍可见
              </label>
              <label class="checkbox-item">
                <input v-model="allowViewAnswer" type="checkbox" />
                允许学生查看标准答案
              </label>
              <label class="checkbox-item">
                <input v-model="allowViewScore" type="checkbox" />
                教师批改后允许学生查看分数
              </label>
            </div>
          </div>
        </div>
        <div class="form-field">
          <label>作业说明</label>
          <textarea v-model="description" placeholder="可选：填写作业要求或说明" />
        </div>
      </div>
      <div class="step-actions">
        <button class="primary-btn" type="button" :disabled="!canEnterStep2" @click="goStep2">
          {{ checkingStep1 ? '校验中...' : '下一步' }}
        </button>
      </div>
    </section>

    <section v-if="step === 2" class="panel glass question-picker-panel">
      <div class="panel-title question-picker-title">
        <span>题库筛选</span>
        <span class="badge">{{ totalSelectedQuestionCount }} 题已选择</span>
      </div>

      <div class="question-source-tabs">
        <button
          type="button"
          class="source-tab"
          :class="{ active: questionSourceMode === 'MIXED' }"
          @click="questionSourceMode = 'MIXED'"
        >
          混合组卷
        </button>
        <button
          type="button"
          class="source-tab"
          :class="{ active: questionSourceMode === 'BANK' }"
          @click="questionSourceMode = 'BANK'"
        >
          从课本题库选题
        </button>
        <button
          type="button"
          class="source-tab"
          :class="{ active: questionSourceMode === 'CUSTOM' }"
          @click="questionSourceMode = 'CUSTOM'"
        >
          自定义题目
        </button>
        <span class="helper-text source-tab-hint">课本筛选作为选题来源之一，可与自定义题混合发布</span>
      </div>

      <div class="question-picker-layout">
        <aside class="question-outline-panel">
          <div class="question-outline-head">
            <div class="question-outline-title">题目概览</div>
            <div class="helper-text">
              题库题 {{ bankSelectedCount }} · 自定义 {{ customSelectedCount }}
            </div>
          </div>
          <div v-if="!questionTypeOutline.length" class="empty-box question-outline-empty">
            尚未选题
          </div>
          <div v-else class="question-outline-list">
            <div v-for="item in questionTypeOutline" :key="item.type" class="question-outline-item">
              <span class="question-outline-label">{{ item.label }}</span>
              <span class="badge">{{ item.count }}</span>
            </div>
          </div>
        </aside>

        <div class="question-main-panel">
          <div
            v-if="questionSourceMode !== 'CUSTOM'"
            class="question-main-card"
          >
            <div class="question-main-card-head">
              <div>
                <div class="question-main-card-title">课本筛选</div>
                <div class="helper-text">按课本章节筛选题库题目</div>
              </div>
              <div class="question-select-count">当前可选 {{ filteredQuestions.length }} 题</div>
            </div>

            <div class="form-grid">
              <div class="form-row">
                <div class="form-field">
                  <label>课本</label>
                  <select v-model="selectedTextbookId" @change="handleTextbookChange">
                    <option value="">请选择课本</option>
                    <option v-for="book in textbooks" :key="book.id" :value="book.id">
                      {{ book.title }}
                    </option>
                  </select>
                </div>
                <div class="form-field">
                  <label>章节</label>
                  <div class="form-row">
                    <div class="form-field">
                      <select v-model="selectedParentChapterId" @change="handleParentChapterChange">
                        <option value="">请选择大章节</option>
                        <option
                          v-for="chapter in parentChapterOptions"
                          :key="chapter.id"
                          :value="chapter.id"
                        >
                          {{ chapter.title }}
                        </option>
                      </select>
                    </div>
                    <div class="form-field">
                      <select v-model="selectedChapterId">
                        <option value="">请选择小章节</option>
                        <option v-for="chapter in childChapterOptions" :key="chapter.id" :value="chapter.id">
                          {{ chapter.title }}
                        </option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
              <div class="question-select-actions">
                <button class="primary-btn" type="button" @click="selectAllVisible">
                  全选当前章节
                </button>
                <button class="primary-btn ghost" type="button" @click="clearSelection">
                  清空选择
                </button>
              </div>
            </div>

            <div class="qb-list" :class="{ 'qb-list-scroll': !expandQuestionList }" style="margin-top: 14px;">
              <div
                v-for="item in visibleQuestions"
                :key="item.id"
                class="qb-item qb-question"
                :class="{ 'is-child': item.depth > 0, active: selectedQuestionIds.has(item.id) }"
              >
                <div class="qb-item-title">
                  <input
                    v-if="item.nodeType === 'LEAF' || item.nodeType === 'GROUP'"
                    type="checkbox"
                    :checked="item.nodeType === 'GROUP' ? isGroupChecked(item.id) : selectedQuestionIds.has(item.id)"
                    @change="toggleQuestion(item.id)"
                  />
                  <span v-if="item.depth" class="qb-indent" />
                  <span
                    v-if="item.isExpandable"
                    class="qb-expand"
                    @click.stop="toggleExpand(item.id)"
                  >
                    {{ expandedIds.has(item.id) ? '▾' : '▸' }}
                  </span>
                  <span
                    class="qb-title-text"
                    @click="item.isExpandable ? toggleExpand(item.id) : viewDetail(item.id)"
                  >
                    {{ getItemTitle(item) }}
                  </span>
                  <span
                    v-if="item.isExpandable && getStemText(item)"
                    class="qb-stem"
                    v-mathjax
                    v-html="renderStemHtml(item)"
                  />
                  <span
                    v-if="item.nodeType === 'LEAF' && getQuestionPreview(item)"
                    class="qb-preview-inline"
                    v-mathjax
                    v-html="getQuestionPreview(item)"
                  />
                  <button
                    class="qb-action qb-detail-btn"
                    type="button"
                    @click.stop="viewDetail(item.id)"
                  >
                    详情
                  </button>
                </div>
              </div>
              <div v-if="!filteredQuestions.length" class="empty-box">
                {{ questionError || '暂无题目' }}
              </div>
            </div>
            <div v-if="filteredQuestions.length > 12" class="qb-footer">
              <button class="qb-toggle" type="button" @click="expandQuestionList = !expandQuestionList">
                {{ expandQuestionList ? '收起列表' : '展开全部' }}
              </button>
              <div class="helper-text">可滚动浏览更多题目</div>
            </div>
          </div>

          <div
            v-if="questionSourceMode !== 'BANK'"
            class="question-main-card"
          >
            <div class="custom-builder">
              <div class="custom-builder-header">
                <div class="custom-builder-title">自定义题目</div>
                <div class="custom-builder-actions">
                  <button
                    v-for="type in quickQuestionTypes"
                    :key="type.value"
                    class="custom-type-btn"
                    type="button"
                    @click="addCustomQuestion(type.value)"
                  >
                    + {{ type.label }}
                  </button>
                </div>
              </div>
              <div v-if="!customQuestions.length" class="empty-box">
                还没有自定义题目，可点击上方按钮添加并与题库题混合发布
              </div>
              <div v-else class="custom-list">
                <div
                  v-for="(question, index) in customQuestions"
                  :key="question.tempId"
                  class="custom-card"
                >
                  <div class="custom-card-head">
                    <div class="custom-card-title">
                      <span class="badge">{{ customTypeLabel(question.questionType) }}</span>
                      <span>自定义第 {{ index + 1 }} 题</span>
                    </div>
                    <button class="qb-action danger" type="button" @click="removeCustomQuestion(question.tempId)">
                      删除
                    </button>
                  </div>
                  <div class="form-row">
                    <div class="form-field">
                      <label>题目标题（可选）</label>
                      <input
                        v-model="question.title"
                        type="text"
                        :placeholder="`例如：${customTypeLabel(question.questionType)}第 ${index + 1} 题`"
                      />
                    </div>
                    <div class="form-field">
                      <label>题目分值</label>
                      <input v-model.number="question.defaultScore" type="number" min="1" step="1" />
                    </div>
                  </div>
                  <div class="form-field">
                    <label>题干</label>
                    <TiptapInput
                      v-model="question.prompt"
                      :min-height="150"
                      placeholder="请输入题干内容，可使用 LaTeX 公式"
                    />
                  </div>
                  <div
                    v-if="['SINGLE_CHOICE', 'MULTI_CHOICE', 'JUDGE'].includes(question.questionType)"
                    class="form-field"
                  >
                    <label>选项</label>
                    <div class="option-list">
                      <div
                        v-for="option in question.options"
                        :key="option.id"
                        class="option-row"
                      >
                        <span class="option-id">{{ option.id }}</span>
                        <input
                          v-model="option.text"
                          type="text"
                          :placeholder="`选项 ${option.id}`"
                          :disabled="question.questionType === 'JUDGE'"
                        />
                        <button
                          v-if="question.questionType !== 'JUDGE' && question.options.length > 2"
                          class="qb-action"
                          type="button"
                          @click="removeOption(question.tempId, option.id)"
                        >
                          移除
                        </button>
                      </div>
                      <button
                        v-if="question.questionType !== 'JUDGE'"
                        class="qb-action"
                        type="button"
                        @click="appendOption(question.tempId)"
                      >
                        添加选项
                      </button>
                    </div>
                  </div>
                  <div v-if="question.questionType === 'SINGLE_CHOICE'" class="form-field">
                    <label>标准答案（单选）</label>
                    <div class="answer-option-list">
                      <label
                        v-for="option in question.options"
                        :key="`single-${question.tempId}-${option.id}`"
                        class="answer-option"
                      >
                        <input
                          type="radio"
                          :name="`single-${question.tempId}`"
                          :checked="question.correctOptionIds[0] === option.id"
                          @change="setSingleChoiceAnswer(question.tempId, option.id)"
                        />
                        {{ option.id }}
                      </label>
                    </div>
                  </div>
                  <div v-if="question.questionType === 'MULTI_CHOICE'" class="form-field">
                    <label>标准答案（多选）</label>
                    <div class="answer-option-list">
                      <label
                        v-for="option in question.options"
                        :key="`multi-${question.tempId}-${option.id}`"
                        class="answer-option"
                      >
                        <input
                          type="checkbox"
                          :checked="question.correctOptionIds.includes(option.id)"
                          @change="toggleMultiChoiceAnswer(question.tempId, option.id)"
                        />
                        {{ option.id }}
                      </label>
                    </div>
                  </div>
                  <div v-if="question.questionType === 'JUDGE'" class="form-field">
                    <label>标准答案（判断）</label>
                    <div class="answer-option-list">
                      <label class="answer-option">
                        <input
                          type="radio"
                          :name="`judge-${question.tempId}`"
                          :checked="question.judgeAnswer === true"
                          @change="setJudgeAnswer(question.tempId, true)"
                        />
                        正确
                      </label>
                      <label class="answer-option">
                        <input
                          type="radio"
                          :name="`judge-${question.tempId}`"
                          :checked="question.judgeAnswer === false"
                          @change="setJudgeAnswer(question.tempId, false)"
                        />
                        错误
                      </label>
                    </div>
                  </div>
                  <div v-if="question.questionType === 'FILL_BLANK'" class="form-field">
                    <label>标准答案（填空）</label>
                    <div class="blank-list">
                      <div
                        v-for="(blank, blankIndex) in question.blankAnswers"
                        :key="`blank-${question.tempId}-${blankIndex}`"
                        class="blank-row"
                      >
                        <input
                          v-model="question.blankAnswers[blankIndex]"
                          type="text"
                          :placeholder="`第 ${blankIndex + 1} 空答案`"
                        />
                        <button
                          v-if="question.blankAnswers.length > 1"
                          class="qb-action"
                          type="button"
                          @click="removeBlankAnswer(question.tempId, blankIndex)"
                        >
                          移除
                        </button>
                      </div>
                      <button class="qb-action" type="button" @click="appendBlankAnswer(question.tempId)">
                        添加空位
                      </button>
                    </div>
                  </div>
                  <div
                    v-if="['SHORT_ANSWER', 'ESSAY', 'CALCULATION', 'PROOF'].includes(question.questionType)"
                    class="form-field"
                  >
                    <label>标准答案（主观题）</label>
                    <TiptapInput
                      v-model="question.standardAnswerText"
                      :min-height="140"
                      placeholder="用于 AI 对照批改，可输入参考步骤、关键点或示例答案"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <section class="panel glass inner-weight-panel">
        <div class="panel-title">
          题目权重
          <span class="badge">合计 {{ weightSum.toFixed(2) }}%</span>
        </div>
        <div v-if="!orderedPublishQuestions.length" class="empty-box">请先选择或创建题目</div>
        <div v-else class="weight-list">
          <div
            v-for="(question, index) in orderedPublishQuestions"
            :key="question.key"
            class="weight-row"
          >
            <div class="weight-title">
              <div class="weight-index">第 {{ index + 1 }} 题</div>
              <div class="weight-parent">
                <span class="badge">{{ customTypeLabel(question.questionType) }}</span>
              </div>
              <div
                v-if="question.source === 'bank' && getParentPromptText(question.raw)"
                class="weight-parent"
                v-mathjax
              >
                <div v-html="getParentPromptText(question.raw)" />
              </div>
              <div class="weight-label" v-mathjax v-html="question.previewHtml" />
            </div>
            <input
              v-model.number="questionWeights[question.key]"
              type="number"
              min="0"
              max="100"
              step="0.1"
              class="weight-input"
            />
            <span class="weight-suffix">%</span>
          </div>
          <div class="weight-actions">
            <button class="primary-btn" type="button" @click="autoBalanceWeights">
              平均分配
            </button>
            <span class="helper-text">权重合计需为 100%</span>
          </div>
        </div>
      </section>

      <div class="step-actions">
        <button class="primary-btn ghost" type="button" @click="step = 1">
          上一步
        </button>
        <button class="primary-btn" type="button" :disabled="!canEnterStep3" @click="goStep3">
          下一步
        </button>
      </div>
    </section>

    <section v-if="step === 3" class="panel glass">
      <div class="panel-title">发布</div>
      <div class="ai-estimate-card" :class="{ disabled: !aiEnabled }">
        <div class="estimate-header">
          <div class="estimate-title">AI 批改开销预估</div>
          <span class="estimate-hint">仅为发布前估算，实际以提交与重试为准</span>
        </div>
        <div v-if="!aiEnabled" class="estimate-disabled-text">
          当前未启用 AI 批改，不会产生 AI 批改成本。
        </div>
        <template v-else>
          <div class="estimate-grid">
            <div class="estimate-item">
              <div class="estimate-label">预计批改任务</div>
              <div class="estimate-value">{{ formatNumber(estimatedAiRuns) }}</div>
              <div class="estimate-sub">学生数 × 题目数</div>
            </div>
            <div class="estimate-item">
              <div class="estimate-label">预计输入 Token</div>
              <div class="estimate-value">{{ formatNumber(estimatedInputTokens) }}</div>
              <div class="estimate-sub">含题目、标准答案、评分细则、图片识别内容</div>
            </div>
            <div class="estimate-item">
              <div class="estimate-label">预计输出 Token</div>
              <div class="estimate-value">{{ formatNumber(estimatedOutputTokens) }}</div>
              <div class="estimate-sub">含分项评分、总评、置信度与存疑原因</div>
            </div>
            <div class="estimate-item">
              <div class="estimate-label">预计批改时长</div>
              <div class="estimate-value">约 {{ estimatedMinutes }} 分钟</div>
              <div class="estimate-sub">按单任务 {{ estimatedSecondsPerRun }} 秒估算</div>
            </div>
          </div>
        <div class="estimate-foot">
            阈值 {{ aiConfidenceThreshold.toFixed(2) }} ·
            {{ handwritingRecognition ? '手写识别模式' : '标准识别模式' }} ·
            {{ strictnessModeText }}（{{ strictnessDistributionLabel }}） ·
            当前课程已有 {{ courseAssignmentCount }} 份作业
          </div>
        </template>
      </div>
      <div class="form-actions">
        <button
          class="primary-btn"
          type="button"
          :disabled="submitLoading || !canPublish"
          @click="handlePublish"
        >
          {{ submitLoading ? '发布中...' : '发布作业' }}
        </button>
        <button class="primary-btn ghost" type="button" @click="step = 2">
          上一步
        </button>
        <span class="helper-text">发布后学生可在作业库看到</span>
      </div>
      <div v-if="submitError" class="form-error">{{ submitError }}</div>
    </section>
  </TeacherLayout>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TeacherLayout from '../components/TeacherLayout.vue'
import TiptapInput from '../components/TiptapInput.vue'
import { useTeacherProfile } from '../composables/useTeacherProfile'
import { getCourseSummary, listCourses } from '../api/course'
import { getQuestionBankStructure, listQuestionBank } from '../api/questionBank'
import {
  createAssignment,
  listTeacherAssignments,
  publishAssignment,
  replaceAssignmentQuestions,
} from '../api/assignment'
import { showAppToast } from '../composables/useAppToast'

const { profileName, profileAccount, refreshProfile } = useTeacherProfile()
const router = useRouter()
const route = useRoute()
const courses = ref([])
const textbooks = ref([])
const chapters = ref([])
const questions = ref([])
const expandedIds = ref(new Set())

const selectedCourseId = ref('')
const selectedTextbookId = ref('')
const selectedParentChapterId = ref('')
const selectedChapterId = ref('')

const title = ref('')
const description = ref('')
const deadline = ref('')
const aiEnabled = ref(true)
const aiGradingStrictness = ref('BALANCED')
const aiPromptGuidance = ref('')
const aiConfidenceThreshold = ref(0.75)
const visibleAfterSubmit = ref(true)
const allowViewAnswer = ref(false)
const allowViewScore = ref(true)
const handwritingRecognition = ref(false)
const totalScore = ref(100)
const courseStudentCount = ref(0)
const courseAssignmentCount = ref(0)

const selectedQuestionIds = ref(new Set())
const selectedQuestionOrder = ref([])
const customQuestions = ref([])
const customQuestionCounter = ref(1)
const isHydrating = ref(true)
const questionWeights = ref({})
const expandQuestionList = ref(false)
const step = ref(1)
const questionSourceMode = ref('MIXED')

const questionError = ref('')
const submitError = ref('')
const submitLoading = ref(false)
const checkingStep1 = ref(false)

const strictnessOptions = [
  {
    value: 'LENIENT',
    label: '宽松',
    distribution: '分布右移，高分段占比更高',
  },
  {
    value: 'BALANCED',
    label: '均衡',
    distribution: '分布居中，整体接近常规正态',
  },
  {
    value: 'STRICT',
    label: '严格',
    distribution: '分布左移，对步骤完整性更敏感',
  },
]

const customTypeLabel = (questionType) => customTypeLabels[questionType] ?? '题目'

const createOptionList = (forJudge = false) => {
  if (forJudge) {
    return [
      { id: 'A', text: '正确' },
      { id: 'B', text: '错误' },
    ]
  }
  return [
    { id: 'A', text: '' },
    { id: 'B', text: '' },
  ]
}

const nextOptionId = (options) => {
  const code = 'A'.charCodeAt(0) + options.length
  if (code <= 'Z'.charCodeAt(0)) {
    return String.fromCharCode(code)
  }
  return `OPT_${options.length + 1}`
}

const createCustomQuestionDraft = (questionType) => {
  const tempId = `tmp-${Date.now()}-${customQuestionCounter.value}`
  customQuestionCounter.value += 1
  const isJudge = questionType === 'JUDGE'
  const isObjective = ['SINGLE_CHOICE', 'MULTI_CHOICE', 'FILL_BLANK', 'JUDGE'].includes(questionType)
  return {
    tempId,
    questionType,
    title: '',
    prompt: '',
    defaultScore: 10,
    allowPartial: questionType === 'MULTI_CHOICE' || questionType === 'FILL_BLANK',
    options: ['SINGLE_CHOICE', 'MULTI_CHOICE', 'JUDGE'].includes(questionType)
      ? createOptionList(isJudge)
      : [],
    correctOptionIds: questionType === 'JUDGE' ? ['A'] : [],
    judgeAnswer: questionType === 'JUDGE' ? true : null,
    blankAnswers: questionType === 'FILL_BLANK' ? [''] : [],
    standardAnswerText: isObjective ? '' : '',
    gradingMode: isObjective ? 'AUTO_RULE' : 'AI_RUBRIC',
  }
}

const sanitizeCustomQuestionDraft = (input) => {
  if (!input || typeof input !== 'object') return null
  const questionType = String(input.questionType || '').toUpperCase()
  if (!quickQuestionTypes.some((item) => item.value === questionType) && !['ESSAY', 'PROOF'].includes(questionType)) {
    return null
  }
  const draft = createCustomQuestionDraft(questionType)
  draft.title = String(input.title || '')
  draft.prompt = String(input.prompt || '')
  draft.defaultScore = Number(input.defaultScore) > 0 ? Number(input.defaultScore) : 10
  draft.allowPartial = Boolean(input.allowPartial)
  if (Array.isArray(input.options)) {
    const options = input.options
      .map((item) => ({
        id: String(item?.id || '').trim(),
        text: String(item?.text || ''),
      }))
      .filter((item) => item.id)
    if (options.length >= 2) {
      draft.options = options
    }
  }
  if (Array.isArray(input.correctOptionIds)) {
    draft.correctOptionIds = input.correctOptionIds.map((item) => String(item)).filter(Boolean)
  }
  if (typeof input.judgeAnswer === 'boolean') {
    draft.judgeAnswer = input.judgeAnswer
  }
  if (Array.isArray(input.blankAnswers)) {
    const blanks = input.blankAnswers.map((item) => String(item || ''))
    if (blanks.length) {
      draft.blankAnswers = blanks
    }
  }
  draft.standardAnswerText = String(input.standardAnswerText || '')
  return draft
}

const addCustomQuestion = (questionType) => {
  customQuestions.value = [...customQuestions.value, createCustomQuestionDraft(questionType)]
  syncWeights()
}

const removeCustomQuestion = (tempId) => {
  customQuestions.value = customQuestions.value.filter((item) => item.tempId !== tempId)
  const key = `custom:${tempId}`
  if (questionWeights.value[key] !== undefined) {
    const next = { ...questionWeights.value }
    delete next[key]
    questionWeights.value = next
  }
  syncWeights()
}

const findCustomQuestion = (tempId) =>
  customQuestions.value.find((item) => item.tempId === tempId)

const appendOption = (tempId) => {
  const question = findCustomQuestion(tempId)
  if (!question) return
  question.options.push({ id: nextOptionId(question.options), text: '' })
}

const removeOption = (tempId, optionId) => {
  const question = findCustomQuestion(tempId)
  if (!question || question.options.length <= 2) return
  question.options = question.options.filter((option) => option.id !== optionId)
  question.correctOptionIds = question.correctOptionIds.filter((id) => id !== optionId)
}

const setSingleChoiceAnswer = (tempId, optionId) => {
  const question = findCustomQuestion(tempId)
  if (!question) return
  question.correctOptionIds = [optionId]
}

const toggleMultiChoiceAnswer = (tempId, optionId) => {
  const question = findCustomQuestion(tempId)
  if (!question) return
  if (question.correctOptionIds.includes(optionId)) {
    question.correctOptionIds = question.correctOptionIds.filter((id) => id !== optionId)
    return
  }
  question.correctOptionIds = [...question.correctOptionIds, optionId]
}

const setJudgeAnswer = (tempId, value) => {
  const question = findCustomQuestion(tempId)
  if (!question) return
  question.judgeAnswer = value
  question.correctOptionIds = [value ? 'A' : 'B']
}

const appendBlankAnswer = (tempId) => {
  const question = findCustomQuestion(tempId)
  if (!question) return
  question.blankAnswers.push('')
}

const removeBlankAnswer = (tempId, blankIndex) => {
  const question = findCustomQuestion(tempId)
  if (!question || question.blankAnswers.length <= 1) return
  question.blankAnswers.splice(blankIndex, 1)
}

const quickQuestionTypes = [
  { value: 'SINGLE_CHOICE', label: '单选题' },
  { value: 'MULTI_CHOICE', label: '多选题' },
  { value: 'FILL_BLANK', label: '填空题' },
  { value: 'JUDGE', label: '判断题' },
  { value: 'SHORT_ANSWER', label: '简答题' },
  { value: 'CALCULATION', label: '计算题' },
]

const customTypeLabels = {
  SINGLE_CHOICE: '单选题',
  MULTI_CHOICE: '多选题',
  FILL_BLANK: '填空题',
  JUDGE: '判断题',
  SHORT_ANSWER: '简答题',
  ESSAY: '论述题',
  CALCULATION: '计算题',
  PROOF: '证明题',
}

const normalizeStrictness = (value) => {
  const candidate = String(value || '').toUpperCase()
  return strictnessOptions.some((item) => item.value === candidate)
    ? candidate
    : 'BALANCED'
}

const normalizeConfidenceThreshold = (value) => {
  const num = Number(value)
  if (!Number.isFinite(num)) return 0.75
  if (num < 0) return 0
  if (num > 1) return 1
  return Number(num.toFixed(3))
}

const strictnessPreset = computed(
  () =>
    strictnessOptions.find((item) => item.value === aiGradingStrictness.value) ??
    strictnessOptions[1],
)

const strictnessDistributionLabel = computed(() => strictnessPreset.value.distribution)

const strictnessModeText = computed(() => strictnessPreset.value.label)

const selectedQuestionCount = computed(
  () => selectedQuestionIds.value.size + customQuestions.value.length,
)

const bankSelectedCount = computed(() => selectedQuestionIds.value.size)
const customSelectedCount = computed(() => customQuestions.value.length)

const questionTypeOutline = computed(() => {
  const typeOrder = [
    'SINGLE_CHOICE',
    'MULTI_CHOICE',
    'FILL_BLANK',
    'JUDGE',
    'SHORT_ANSWER',
    'CALCULATION',
    'ESSAY',
    'PROOF',
  ]
  const bucket = new Map()
  orderedPublishQuestions.value.forEach((question) => {
    const type = String(question.questionType || 'SHORT_ANSWER')
    bucket.set(type, (bucket.get(type) || 0) + 1)
  })
  return typeOrder
    .map((type) => ({
      type,
      label: customTypeLabel(type),
      count: bucket.get(type) || 0,
    }))
    .filter((item) => item.count > 0)
})

const estimatedAiRuns = computed(() =>
  aiEnabled.value ? courseStudentCount.value * selectedQuestionCount.value : 0,
)

const estimatedSecondsPerRun = computed(() =>
  handwritingRecognition.value ? 2.2 : 1.6,
)

const estimatedInputPerRun = computed(() => {
  const base = handwritingRecognition.value ? 1400 : 1100
  const questionFactor = Math.max(selectedQuestionCount.value, 1) * 120
  return base + questionFactor
})

const estimatedOutputPerRun = computed(() => 220 + Math.max(selectedQuestionCount.value, 1) * 25)

const estimatedInputTokens = computed(() => Math.round(estimatedAiRuns.value * estimatedInputPerRun.value))
const estimatedOutputTokens = computed(() =>
  Math.round(estimatedAiRuns.value * estimatedOutputPerRun.value),
)
const estimatedMinutes = computed(() =>
  estimatedAiRuns.value <= 0
    ? 0
    : Math.max(1, Math.round((estimatedAiRuns.value * estimatedSecondsPerRun.value) / 60)),
)

const formatNumber = (value) =>
  Number(value || 0).toLocaleString('zh-CN')

const STORAGE_KEY = 'teacher.assignment.publish.filters'
const FORM_KEY = 'teacher.assignment.publish.form'

const hydrateFilters = async () => {
  const raw = sessionStorage.getItem(STORAGE_KEY)
  const stored = raw ? JSON.parse(raw) : null
  const courseId = String(route.query.courseId ?? '') || stored?.courseId || ''
  const textbookId = String(route.query.textbookId ?? '') || stored?.textbookId || ''
  const parentChapterId =
    String(route.query.parentChapterId ?? '') || stored?.parentChapterId || ''
  const chapterId = String(route.query.chapterId ?? '') || stored?.chapterId || ''
  if (!courseId) return
  selectedCourseId.value = courseId
  await handleCourseChange({ keepSelection: true })
  selectedTextbookId.value = textbookId || ''
  selectedParentChapterId.value = parentChapterId || ''
  selectedChapterId.value = chapterId || ''
}

const persistFilters = () => {
  const payload = {
    courseId: selectedCourseId.value,
    textbookId: selectedTextbookId.value,
    parentChapterId: selectedParentChapterId.value,
    chapterId: selectedChapterId.value,
  }
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  router.replace({
    query: {
      ...route.query,
      courseId: payload.courseId || undefined,
      textbookId: payload.textbookId || undefined,
      parentChapterId: payload.parentChapterId || undefined,
      chapterId: payload.chapterId || undefined,
    },
  })
}

const hydrateForm = async () => {
  const raw = sessionStorage.getItem(FORM_KEY)
  if (!raw) return
  try {
    const payload = JSON.parse(raw)
    if (payload?.selectedCourseId) {
      selectedCourseId.value = payload.selectedCourseId
      await handleCourseChange({ keepSelection: true })
    }
    selectedTextbookId.value = payload?.selectedTextbookId ?? selectedTextbookId.value
    selectedParentChapterId.value =
      payload?.selectedParentChapterId ?? selectedParentChapterId.value
    selectedChapterId.value = payload?.selectedChapterId ?? selectedChapterId.value
    if (selectedChapterId.value && !selectedParentChapterId.value) {
      const match = chapters.value.find((item) => item.id === selectedChapterId.value)
      if (match?.parentId) {
        selectedParentChapterId.value = match.parentId
      }
    }
    title.value = payload?.title ?? title.value
    description.value = payload?.description ?? description.value
    deadline.value = payload?.deadline ?? deadline.value
    aiEnabled.value =
      typeof payload?.aiEnabled === 'boolean' ? payload.aiEnabled : aiEnabled.value
    aiGradingStrictness.value = normalizeStrictness(
      payload?.aiGradingStrictness ?? aiGradingStrictness.value,
    )
    aiPromptGuidance.value =
      typeof payload?.aiPromptGuidance === 'string'
        ? payload.aiPromptGuidance
        : aiPromptGuidance.value
    visibleAfterSubmit.value =
      typeof payload?.visibleAfterSubmit === 'boolean'
        ? payload.visibleAfterSubmit
        : visibleAfterSubmit.value
    allowViewAnswer.value =
      typeof payload?.allowViewAnswer === 'boolean'
        ? payload.allowViewAnswer
        : allowViewAnswer.value
    allowViewScore.value =
      typeof payload?.allowViewScore === 'boolean'
        ? payload.allowViewScore
        : allowViewScore.value
    handwritingRecognition.value =
      typeof payload?.handwritingRecognition === 'boolean'
        ? payload.handwritingRecognition
        : handwritingRecognition.value
    aiConfidenceThreshold.value =
      typeof payload?.aiConfidenceThreshold === 'number'
        ? normalizeConfidenceThreshold(payload.aiConfidenceThreshold)
        : aiConfidenceThreshold.value
    totalScore.value =
      typeof payload?.totalScore === 'number' ? payload.totalScore : totalScore.value
    step.value = payload?.step ?? step.value
    questionSourceMode.value =
      payload?.questionSourceMode === 'BANK' || payload?.questionSourceMode === 'CUSTOM'
        ? payload.questionSourceMode
        : 'MIXED'

    const ids = Array.isArray(payload?.selectedQuestionIds)
      ? payload.selectedQuestionIds
      : []
    const order = Array.isArray(payload?.selectedQuestionOrder)
      ? payload.selectedQuestionOrder
      : []
    selectedQuestionIds.value = new Set(ids)
    selectedQuestionOrder.value = order.length ? order : ids
    questionWeights.value = payload?.questionWeights ?? {}
    expandQuestionList.value = payload?.expandQuestionList ?? false
    customQuestions.value = Array.isArray(payload?.customQuestions)
      ? payload.customQuestions
          .map((item) => sanitizeCustomQuestionDraft(item))
          .filter((item) => Boolean(item))
      : []
    customQuestionCounter.value =
      typeof payload?.customQuestionCounter === 'number' && payload.customQuestionCounter > 0
        ? payload.customQuestionCounter
        : customQuestions.value.length + 1

    const stepFromQuery = Number(route.query.step ?? 0)
    if ([1, 2, 3].includes(stepFromQuery)) {
      step.value = stepFromQuery
    }
  } catch {
    // ignore
  }
}

const persistForm = () => {
  const payload = {
    selectedCourseId: selectedCourseId.value,
    selectedTextbookId: selectedTextbookId.value,
    selectedParentChapterId: selectedParentChapterId.value,
    selectedChapterId: selectedChapterId.value,
    title: title.value,
    description: description.value,
    deadline: deadline.value,
    aiEnabled: aiEnabled.value,
    aiGradingStrictness: aiGradingStrictness.value,
    aiPromptGuidance: aiPromptGuidance.value,
    visibleAfterSubmit: visibleAfterSubmit.value,
    allowViewAnswer: allowViewAnswer.value,
    allowViewScore: allowViewScore.value,
    handwritingRecognition: handwritingRecognition.value,
    aiConfidenceThreshold: aiConfidenceThreshold.value,
    totalScore: totalScore.value,
    step: step.value,
    questionSourceMode: questionSourceMode.value,
    selectedQuestionIds: Array.from(selectedQuestionIds.value),
    selectedQuestionOrder: selectedQuestionOrder.value,
    customQuestions: customQuestions.value,
    customQuestionCounter: customQuestionCounter.value,
    questionWeights: questionWeights.value,
    expandQuestionList: expandQuestionList.value,
  }
  sessionStorage.setItem(FORM_KEY, JSON.stringify(payload))
}

onMounted(async () => {
  await refreshProfile()
  await fetchCourses()
  isHydrating.value = true
  await hydrateFilters()
  await hydrateForm()
  isHydrating.value = false
})

watch([selectedCourseId, selectedTextbookId, selectedParentChapterId, selectedChapterId], () => {
  if (isHydrating.value) return
  persistFilters()
})

watch([selectedQuestionIds, selectedQuestionOrder, customQuestions], () => {
  syncWeights()
}, { deep: true })

watch(aiEnabled, (enabled) => {
  if (!enabled) {
    handwritingRecognition.value = false
  }
})

watch(
  [
    selectedCourseId,
    selectedTextbookId,
    selectedParentChapterId,
    selectedChapterId,
    title,
    description,
    deadline,
    aiEnabled,
    aiGradingStrictness,
    aiPromptGuidance,
    visibleAfterSubmit,
    allowViewAnswer,
    allowViewScore,
    handwritingRecognition,
    aiConfidenceThreshold,
    totalScore,
    step,
    questionSourceMode,
    selectedQuestionIds,
    selectedQuestionOrder,
    customQuestions,
    customQuestionCounter,
    questionWeights,
    expandQuestionList,
  ],
  () => {
    if (isHydrating.value) return
    persistForm()
  },
  { deep: true },
)

const fetchCourses = async () => {
  try {
    const response = await listCourses()
    courses.value = response.items ?? []
  } catch (err) {
    questionError.value = err instanceof Error ? err.message : '加载课程失败'
  }
}

const loadCourseSummary = async (courseId) => {
  if (!courseId) {
    courseStudentCount.value = 0
    courseAssignmentCount.value = 0
    return
  }
  try {
    const summary = await getCourseSummary(courseId)
    courseStudentCount.value = Number(summary?.studentCount ?? 0)
    courseAssignmentCount.value = Number(summary?.assignmentCount ?? 0)
  } catch {
    courseStudentCount.value = 0
    courseAssignmentCount.value = 0
  }
}

const handleCourseChange = async (options = { keepSelection: false }) => {
  selectedTextbookId.value = ''
  selectedParentChapterId.value = ''
  selectedChapterId.value = ''
  if (!options.keepSelection) {
    selectedQuestionIds.value = new Set()
    selectedQuestionOrder.value = []
    questionWeights.value = {}
  }
  questionError.value = ''
  if (!selectedCourseId.value) {
    textbooks.value = []
    chapters.value = []
    questions.value = []
    courseStudentCount.value = 0
    courseAssignmentCount.value = 0
    return
  }
  try {
    const [response] = await Promise.all([
      getQuestionBankStructure(),
      loadCourseSummary(selectedCourseId.value),
    ])
    textbooks.value = response.textbooks ?? []
    chapters.value = response.chapters ?? []
    questions.value = await listQuestionBank()
    if (selectedChapterId.value && !selectedParentChapterId.value) {
      const match = chapters.value.find((item) => item.id === selectedChapterId.value)
      if (match?.parentId) {
        selectedParentChapterId.value = match.parentId
      }
    }
  } catch (err) {
    questionError.value = err instanceof Error ? err.message : '加载题库失败'
  }
}

const handleTextbookChange = () => {
  selectedParentChapterId.value = ''
  selectedChapterId.value = ''
}

const parentChapterOptions = computed(() => {
  if (!selectedTextbookId.value) return []
  const items = chapters.value.filter(
    (chapter) => chapter.textbookId === selectedTextbookId.value,
  )
  if (!items.length) return []
  const parentIds = new Set(items.map((item) => item.parentId).filter(Boolean))
  return items
    .filter((item) => parentIds.has(item.id) || !item.parentId)
    .sort((a, b) => (a.orderNo ?? 0) - (b.orderNo ?? 0))
})

const childChapterOptions = computed(() => {
  if (!selectedParentChapterId.value) return []
  return chapters.value
    .filter((chapter) => chapter.parentId === selectedParentChapterId.value)
    .sort((a, b) => (a.orderNo ?? 0) - (b.orderNo ?? 0))
})

const handleParentChapterChange = () => {
  selectedChapterId.value = ''
}

const chapterIdsByTextbook = computed(() => {
  if (!selectedTextbookId.value) return new Set()
  return new Set(
    chapters.value
      .filter((chapter) => chapter.textbookId === selectedTextbookId.value)
      .map((chapter) => chapter.id),
  )
})

const getQuestionLabel = (item) => {
  const title = item.title?.trim()
  if (title) return title
  if (typeof item.prompt === 'string') return item.prompt.slice(0, 24)
  if (item.prompt?.text) return String(item.prompt.text).slice(0, 24)
  return '未命名题目'
}

const filteredQuestions = computed(() => {
  if (!selectedChapterId.value) return []
  return questions.value
    .filter((item) => {
      return item.chapterId === selectedChapterId.value
    })
    .map((item) => ({
      ...item,
      label: getQuestionLabel(item),
    }))
})

const flattenedQuestions = computed(() => {
  const byParent = new Map()
  filteredQuestions.value.forEach((item, idx) => {
    const parentId = item.parentId ?? ''
    if (!byParent.has(parentId)) {
      byParent.set(parentId, [])
    }
    byParent.get(parentId).push({ ...item, __index: idx })
  })
  for (const list of byParent.values()) {
    list.sort((a, b) => {
      const aIndex = parseQuestionIndex(a)
      const bIndex = parseQuestionIndex(b)
      if (aIndex !== null || bIndex !== null) {
        if (aIndex === null) return 1
        if (bIndex === null) return -1
        return aIndex - bIndex
      }
      const aHas = a.orderNo !== null && a.orderNo !== undefined
      const bHas = b.orderNo !== null && b.orderNo !== undefined
      if (aHas !== bHas) return aHas ? -1 : 1
      if (aHas && bHas) return Number(a.orderNo) - Number(b.orderNo)
      return a.__index - b.__index
    })
  }

  const result = []
  const walk = (parentId, depth) => {
    const children = byParent.get(parentId) ?? []
    for (const [index, child] of children.entries()) {
      const isExpandable = (byParent.get(child.id) ?? []).length > 0
      const displayOrder = child.orderNo ?? index + 1
      const { __index, ...rest } = child
      result.push({ ...rest, depth, isExpandable, displayOrder })
      walk(child.id, depth + 1)
    }
  }
  walk('', 0)
  return result
})

const visibleQuestions = computed(() => {
  const byId = new Map(flattenedQuestions.value.map((item) => [item.id, item]))
  const list = flattenedQuestions.value.filter((item) => {
    let parentId = item.parentId ?? ''
    while (parentId) {
      if (!expandedIds.value.has(parentId)) return false
      const parent = byId.get(parentId)
      if (!parent) break
      parentId = parent.parentId ?? ''
    }
    return true
  })
  if (expandQuestionList.value) return list
  return list.slice(0, 12)
})


const toggleQuestion = (id) => {
  const item = questions.value.find((q) => q.id === id)
  const next = new Set(selectedQuestionIds.value)
  const order = [...selectedQuestionOrder.value]
  if (!item) return

  if (item.nodeType === 'GROUP') {
    const leafIds = getDescendantLeafIdsInOrder(item.id)
    if (!leafIds.length) return
    const allSelected = leafIds.every((leafId) => next.has(leafId))
    if (allSelected) {
      leafIds.forEach((leafId) => next.delete(leafId))
      const removeSet = new Set(leafIds)
      const filtered = order.filter((leafId) => !removeSet.has(leafId))
      selectedQuestionIds.value = next
      selectedQuestionOrder.value = filtered
      return
    }
    const orderSet = new Set(order)
    leafIds.forEach((leafId) => next.add(leafId))
    leafIds.forEach((leafId) => {
      if (!orderSet.has(leafId)) {
        order.push(leafId)
        orderSet.add(leafId)
      }
    })
    selectedQuestionIds.value = next
    selectedQuestionOrder.value = order
    return
  }

  if (next.has(id)) {
    next.delete(id)
    const index = order.indexOf(id)
    if (index >= 0) order.splice(index, 1)
  } else {
    next.add(id)
    order.push(id)
  }
  selectedQuestionIds.value = next
  selectedQuestionOrder.value = order
}

const selectAllVisible = () => {
  const next = new Set(selectedQuestionIds.value)
  const order = [...selectedQuestionOrder.value]
  for (const item of visibleQuestions.value) {
    if (item.nodeType === 'LEAF') {
      next.add(item.id)
      if (!order.includes(item.id)) {
        order.push(item.id)
      }
    }
  }
  selectedQuestionIds.value = next
  selectedQuestionOrder.value = order
}

const clearSelection = () => {
  selectedQuestionIds.value = new Set()
  selectedQuestionOrder.value = []
}

const toggleExpand = (questionId) => {
  const next = new Set(expandedIds.value)
  if (next.has(questionId)) {
    next.delete(questionId)
  } else {
    next.add(questionId)
  }
  expandedIds.value = next
}

const getStemText = (item) => {
  if (!item?.stem) return ''
  if (typeof item.stem === 'string') return item.stem
  return item.stem.text ?? ''
}

const getQuestionPreviewText = (item) => {
  if (!item) return ''
  const stem = getStemText(item)
  if (stem) return stem
  if (typeof item.prompt === 'string') return item.prompt
  if (item.prompt?.text) return item.prompt.text
  if (item.description) return item.description
  return ''
}

const getQuestionPreview = (item) => {
  const text = getQuestionPreviewText(item)
  if (!text) return ''
  return text.replace(/\n/g, '<br />')
}

const renderStemHtml = (item) => {
  const text = getStemText(item)
  if (!text) return ''
  return text.replace(/\n/g, '<br />')
}

const getItemTitle = (item) => {
  if (item?.title) return item.title
  if (item?.depth > 0) return `（${item.displayOrder ?? 1}）`
  return '未命名'
}

const parseQuestionIndex = (item) => {
  const title = item?.title ?? ''
  const label = item?.label ?? ''
  const text = `${title} ${label}`
  const match = text.match(/第\s*(\d+)\s*题/)
  if (!match) return null
  const value = Number(match[1])
  return Number.isFinite(value) ? value : null
}

const questionById = computed(() => new Map(questions.value.map((item) => [item.id, item])))
const filteredQuestionById = computed(
  () => new Map(filteredQuestions.value.map((item) => [item.id, item])),
)

const orderedSelectedQuestions = computed(() => {
  const map = questionById.value
  return selectedQuestionOrder.value
    .map((id) => map.get(id))
    .filter((item) => item && item.nodeType === 'LEAF')
})

const orderedPublishQuestions = computed(() => {
  const bankPart = orderedSelectedQuestions.value.map((question, index) => ({
    key: question.id,
    source: 'bank',
    questionType: String(question.questionType || 'SHORT_ANSWER'),
    previewHtml: getWeightLabel(question),
    orderNo: index + 1,
    raw: question,
  }))
  const customPart = customQuestions.value.map((question, index) => ({
    key: `custom:${question.tempId}`,
    source: 'custom',
    questionType: question.questionType,
    previewHtml: (question.prompt || question.title || `自定义第 ${index + 1} 题`).replace(/\n/g, '<br />'),
    orderNo: bankPart.length + index + 1,
    raw: question,
  }))
  return [...bankPart, ...customPart]
})

const totalSelectedQuestionCount = computed(() => orderedPublishQuestions.value.length)

const isDescendantOf = (itemId, ancestorId) => {
  let current = filteredQuestionById.value.get(itemId)
  while (current?.parentId) {
    if (current.parentId === ancestorId) return true
    current = filteredQuestionById.value.get(current.parentId)
  }
  return false
}

const getDescendantLeafIdsInOrder = (groupId) =>
  flattenedQuestions.value
    .filter((item) => item.nodeType === 'LEAF' && isDescendantOf(item.id, groupId))
    .map((item) => item.id)

const isGroupChecked = (groupId) => {
  const ids = getDescendantLeafIdsInOrder(groupId)
  if (!ids.length) return false
  return ids.every((id) => selectedQuestionIds.value.has(id))
}

const weightSum = computed(() =>
  Object.values(questionWeights.value).reduce(
    (sum, value) => sum + (Number(value) || 0),
    0,
  ),
)

const canEnterStep2 = computed(() => {
  if (checkingStep1.value) return false
  if (!selectedCourseId.value) return false
  if (!title.value.trim()) return false
  return true
})

const canEnterStep3 = computed(() => {
  return orderedPublishQuestions.value.length > 0
})

const canPublish = computed(() => {
  if (!orderedPublishQuestions.value.length) return false
  if (!Number.isFinite(Number(totalScore.value)) || Number(totalScore.value) <= 0) return false
  if (
    !Number.isFinite(Number(aiConfidenceThreshold.value)) ||
    Number(aiConfidenceThreshold.value) < 0 ||
    Number(aiConfidenceThreshold.value) > 1
  )
    return false
  return Math.abs(weightSum.value - 100) <= 0.01
})

const syncWeights = () => {
  const keys = orderedPublishQuestions.value.map((item) => item.key)
  const keySet = new Set(keys)
  const next = { ...questionWeights.value }
  let changed = false

  for (const key of keys) {
    if (next[key] === undefined) {
      next[key] = 0
      changed = true
    }
  }
  for (const key of Object.keys(next)) {
    if (!keySet.has(key)) {
      delete next[key]
      changed = true
    }
  }
  const hasAny = keys.length > 0
  const sum = Object.values(next).reduce((acc, val) => acc + (Number(val) || 0), 0)
  if (hasAny && sum === 0) {
    const equal = Number((100 / keys.length).toFixed(2))
    keys.forEach((key, index) => {
      next[key] =
        index === keys.length - 1
          ? Number((100 - equal * (keys.length - 1)).toFixed(2))
          : equal
    })
    changed = true
  }

  if (changed) {
    questionWeights.value = next
  }
}

const autoBalanceWeights = () => {
  const keys = orderedPublishQuestions.value.map((item) => item.key)
  if (!keys.length) return
  const equal = Number((100 / keys.length).toFixed(2))
  const next = {}
  keys.forEach((key, index) => {
    next[key] =
      index === keys.length - 1
        ? Number((100 - equal * (keys.length - 1)).toFixed(2))
        : equal
  })
  questionWeights.value = next
}

const getParentPromptText = (question) => {
  if (!question?.parentId) return ''
  const map = questionById.value
  let current = map.get(question.parentId)
  while (current) {
    const text =
      (typeof current.stem === 'string' ? current.stem : current.stem?.text) ||
      (typeof current.prompt === 'string' ? current.prompt : current.prompt?.text) ||
      current.description ||
      ''
    if (text) return text.replace(/\n/g, '<br />')
    current = current.parentId ? map.get(current.parentId) : null
  }
  return ''
}

const getWeightLabel = (question) => {
  const text = getQuestionPreviewText(question)
  if (!text) return getQuestionLabel(question)
  return text.replace(/\n/g, '<br />')
}

const viewDetail = (questionId) => {
  router.push({
    path: `/teacher/question-bank/questions/${questionId}`,
    query: {
      from: 'publish',
      step: String(step.value),
      courseId: selectedCourseId.value || undefined,
      textbookId: selectedTextbookId.value || undefined,
      parentChapterId: selectedParentChapterId.value || undefined,
      chapterId: selectedChapterId.value || undefined,
    },
  })
}

const hasDuplicateAssignmentTitle = async () => {
  const normalizedTitle = title.value.trim().toLowerCase()
  if (!selectedCourseId.value || !normalizedTitle) return false
  const teacherAssignments = await listTeacherAssignments()
  return (teacherAssignments.items ?? []).some((item) => {
    const itemCourseId = String(item.courseId ?? '')
    const itemTitle = String(item.title ?? '').trim().toLowerCase()
    return itemCourseId === selectedCourseId.value && itemTitle === normalizedTitle
  })
}

const goStep2 = async () => {
  submitError.value = ''
  if (!selectedCourseId.value || !title.value.trim()) return
  if (checkingStep1.value) return
  checkingStep1.value = true
  try {
    const duplicateExists = await hasDuplicateAssignmentTitle()
    if (duplicateExists) {
      submitError.value = '同一课程下作业标题已存在，请更换后再继续'
      showAppToast(submitError.value, 'error')
      return
    }
    step.value = 2
  } catch (err) {
    submitError.value = err instanceof Error ? err.message : '作业标题校验失败'
    showAppToast(submitError.value, 'error')
  } finally {
    checkingStep1.value = false
  }
}

const validateCustomQuestion = (question, displayIndex) => {
  const label = `${customTypeLabel(question.questionType)}（第 ${displayIndex} 题）`
  if (!String(question.prompt || '').trim()) {
    return `${label}缺少题干`
  }
  if (!Number.isFinite(Number(question.defaultScore)) || Number(question.defaultScore) <= 0) {
    return `${label}分值必须大于 0`
  }
  if (['SINGLE_CHOICE', 'MULTI_CHOICE', 'JUDGE'].includes(question.questionType)) {
    const options = Array.isArray(question.options) ? question.options : []
    if (options.length < 2) return `${label}至少需要 2 个选项`
    const emptyOption = options.find((option) => !String(option.text || '').trim())
    if (emptyOption) return `${label}存在空选项，请补全`
    if (question.questionType === 'SINGLE_CHOICE' && question.correctOptionIds.length !== 1) {
      return `${label}请选择 1 个标准答案`
    }
    if (question.questionType === 'MULTI_CHOICE' && question.correctOptionIds.length < 1) {
      return `${label}请至少选择 1 个标准答案`
    }
    if (question.questionType === 'JUDGE' && typeof question.judgeAnswer !== 'boolean') {
      return `${label}请设置判断题标准答案`
    }
  }
  if (question.questionType === 'FILL_BLANK') {
    const blanks = Array.isArray(question.blankAnswers) ? question.blankAnswers : []
    if (!blanks.length) return `${label}至少需要 1 个填空答案`
    const invalid = blanks.find((item) => !String(item || '').trim())
    if (invalid !== undefined) return `${label}存在空白答案，请补全`
  }
  if (['SHORT_ANSWER', 'ESSAY', 'CALCULATION', 'PROOF'].includes(question.questionType)) {
    if (!String(question.standardAnswerText || '').trim()) {
      return `${label}请填写标准答案`
    }
  }
  return ''
}

const goStep3 = () => {
  submitError.value = ''
  const mixed = orderedPublishQuestions.value
  if (!mixed.length) {
    submitError.value = '请至少选择或创建一道题目'
    showAppToast(submitError.value, 'error')
    return
  }
  for (let i = 0; i < customQuestions.value.length; i += 1) {
    const message = validateCustomQuestion(customQuestions.value[i], i + 1)
    if (message) {
      submitError.value = message
      showAppToast(message, 'error')
      return
    }
  }
  syncWeights()
  if (Math.abs(weightSum.value - 100) > 0.01) {
    submitError.value = '题目权重之和必须为 100%'
    showAppToast(submitError.value, 'error')
    return
  }
  step.value = 3
}

const buildCustomQuestionPayload = (question, questionIndex) => {
  const type = String(question.questionType || 'SHORT_ANSWER')
  const base = {
    questionIndex,
    title: String(question.title || '').trim() || `${customTypeLabel(type)} ${questionIndex}`,
    prompt: String(question.prompt || '').trim(),
    questionType: type,
    defaultScore: Number(question.defaultScore || 10),
    gradingPolicy: {
      mode: ['SINGLE_CHOICE', 'MULTI_CHOICE', 'FILL_BLANK', 'JUDGE'].includes(type)
        ? 'AUTO_RULE'
        : 'AI_RUBRIC',
    },
  }

  if (['SINGLE_CHOICE', 'MULTI_CHOICE'].includes(type)) {
    const options = question.options.map((item) => ({
      id: String(item.id),
      text: String(item.text || '').trim(),
    }))
    return {
      ...base,
      questionSchema: {
        options,
        allowPartial: type === 'MULTI_CHOICE' ? Boolean(question.allowPartial) : false,
      },
      standardAnswer: {
        correctOptionIds: question.correctOptionIds,
      },
    }
  }

  if (type === 'JUDGE') {
    return {
      ...base,
      questionSchema: {
        options: [
          { id: 'A', text: '正确' },
          { id: 'B', text: '错误' },
        ],
        allowPartial: false,
      },
      standardAnswer: {
        value: Boolean(question.judgeAnswer),
      },
    }
  }

  if (type === 'FILL_BLANK') {
    const blanks = question.blankAnswers.map((item) => String(item || '').trim())
    return {
      ...base,
      questionSchema: {
        blankCount: blanks.length,
        allowPartial: Boolean(question.allowPartial),
      },
      standardAnswer: {
        blanks,
      },
    }
  }

  const answerText = String(question.standardAnswerText || '').trim()
  return {
    ...base,
    standardAnswer: {
      text: answerText,
    },
    rubric: [
      {
        rubricItemKey: 'R1',
        maxScore: Number(question.defaultScore || 10),
        criteria: '依据标准答案与步骤完整性评分',
      },
    ],
  }
}

const handlePublish = async () => {
  submitError.value = ''

  if (!selectedCourseId.value) {
    submitError.value = '请先选择课程'
    showAppToast(submitError.value, 'error')
    return
  }
  if (!title.value.trim()) {
    submitError.value = '请填写作业标题'
    showAppToast(submitError.value, 'error')
    return
  }

  const mixed = orderedPublishQuestions.value
  if (!mixed.length) {
    submitError.value = '请至少选择或创建一道题目'
    showAppToast(submitError.value, 'error')
    return
  }
  for (let i = 0; i < customQuestions.value.length; i += 1) {
    const message = validateCustomQuestion(customQuestions.value[i], i + 1)
    if (message) {
      submitError.value = message
      showAppToast(message, 'error')
      return
    }
  }
  syncWeights()
  if (Math.abs(weightSum.value - 100) > 0.01) {
    submitError.value = '题目权重之和必须为 100%'
    showAppToast(submitError.value, 'error')
    return
  }

  if (submitLoading.value) return
  submitLoading.value = true
  try {
    const duplicateExists = await hasDuplicateAssignmentTitle()
    if (duplicateExists) {
      submitError.value = '同一课程下作业标题已存在，请更换后再发布'
      showAppToast(submitError.value, 'error')
      return
    }

    const bankQuestionIds = orderedSelectedQuestions.value.map((item) => item.id)
    const customPayload = customQuestions.value.map((question, index) =>
      buildCustomQuestionPayload(question, index + 1),
    )

    const created = await createAssignment({
      courseId: selectedCourseId.value,
      title: title.value.trim(),
      description: description.value.trim() || undefined,
      deadline: deadline.value || undefined,
      totalScore: Number(totalScore.value) || 100,
      aiEnabled: aiEnabled.value,
      aiGradingStrictness: normalizeStrictness(aiGradingStrictness.value),
      aiPromptGuidance: aiPromptGuidance.value.trim() || undefined,
      visibleAfterSubmit: visibleAfterSubmit.value,
      allowViewAnswer: allowViewAnswer.value,
      allowViewScore: allowViewScore.value,
      handwritingRecognition: handwritingRecognition.value,
      aiConfidenceThreshold: normalizeConfidenceThreshold(aiConfidenceThreshold.value),
      selectedQuestionIds: bankQuestionIds,
      questions: customPayload,
    })
    const assignmentId = created.id
    const customIdMap = new Map()
    const createdQuestionIds = Array.isArray(created.selectedQuestionIds)
      ? created.selectedQuestionIds
      : []
    customQuestions.value.forEach((item, index) => {
      const createdId = createdQuestionIds[index]
      if (createdId) {
        customIdMap.set(item.tempId, createdId)
      }
    })
    if (customQuestions.value.length > 0 && customIdMap.size !== customQuestions.value.length) {
      throw new Error('部分自定义题创建失败，请重试')
    }

    const finalOrderedQuestionIds = mixed
      .map((item) => {
        if (item.source === 'bank') return String(item.key)
        const tempId = String(item.raw?.tempId || '')
        return customIdMap.get(tempId) ?? ''
      })
      .filter((item) => Boolean(item))

    if (finalOrderedQuestionIds.length !== mixed.length) {
      throw new Error('题目顺序映射失败，请重试发布')
    }

    await replaceAssignmentQuestions(assignmentId, finalOrderedQuestionIds)

    const weightsPayload = mixed.map((item) => {
      const questionId =
        item.source === 'bank'
          ? String(item.key)
          : customIdMap.get(String(item.raw?.tempId || '')) || ''
      return {
        questionId,
        weight: Number(questionWeights.value[item.key] ?? 0),
      }
    })
    await publishAssignment(assignmentId, { questionWeights: weightsPayload })
    showAppToast('作业发布成功', 'success')
    sessionStorage.removeItem(FORM_KEY)
    selectedCourseId.value = ''
    selectedTextbookId.value = ''
    selectedChapterId.value = ''
    title.value = ''
    description.value = ''
    deadline.value = ''
    aiEnabled.value = true
    aiGradingStrictness.value = 'BALANCED'
    aiPromptGuidance.value = ''
    visibleAfterSubmit.value = true
    allowViewAnswer.value = false
    allowViewScore.value = true
    handwritingRecognition.value = false
    aiConfidenceThreshold.value = 0.75
    totalScore.value = 100
    selectedQuestionIds.value = new Set()
    selectedQuestionOrder.value = []
    customQuestions.value = []
    customQuestionCounter.value = 1
    questionWeights.value = {}
    expandQuestionList.value = false
    step.value = 1
    questionSourceMode.value = 'MIXED'
  } catch (err) {
    submitError.value = err instanceof Error ? err.message : '发布失败'
    showAppToast(submitError.value, 'error')
  } finally {
    submitLoading.value = false
  }
}
</script>

<style scoped>
.question-picker-panel {
  display: grid;
  gap: 14px;
}

.inner-weight-panel {
  box-shadow: none;
  border: 1px solid rgba(196, 213, 238, 0.52);
  background: rgba(255, 255, 255, 0.58);
}

.question-picker-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.question-source-tabs {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.66);
  border: 1px solid rgba(196, 213, 238, 0.5);
}

.source-tab {
  border: 1px solid rgba(183, 201, 230, 0.7);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.78);
  color: rgba(26, 29, 51, 0.74);
  font-size: 13px;
  font-weight: 600;
  padding: 8px 14px;
  cursor: pointer;
  transition: all 0.16s ease;
}

.source-tab:hover {
  border-color: rgba(122, 166, 233, 0.8);
  color: rgba(26, 29, 51, 0.9);
}

.source-tab.active {
  border-color: rgba(99, 146, 232, 0.85);
  background: linear-gradient(135deg, rgba(90, 140, 255, 0.85), rgba(120, 200, 230, 0.85));
  color: #fff;
}

.source-tab-hint {
  margin-left: auto;
}

.question-picker-layout {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}

.question-outline-panel {
  border-radius: 14px;
  border: 1px solid rgba(196, 213, 238, 0.5);
  background: rgba(255, 255, 255, 0.66);
  padding: 12px;
  display: grid;
  gap: 10px;
}

.question-outline-head {
  display: grid;
  gap: 4px;
}

.question-outline-title {
  font-size: 15px;
  font-weight: 700;
  color: rgba(26, 29, 51, 0.92);
}

.question-outline-empty {
  min-height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.question-outline-list {
  display: grid;
  gap: 8px;
}

.question-outline-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border-radius: 10px;
  padding: 8px 10px;
  border: 1px solid rgba(211, 223, 243, 0.56);
  background: rgba(255, 255, 255, 0.78);
}

.question-outline-label {
  font-size: 13px;
  font-weight: 600;
  color: rgba(26, 29, 51, 0.85);
}

.question-main-panel {
  display: grid;
  gap: 14px;
}

.question-main-card {
  border-radius: 14px;
  border: 1px solid rgba(196, 213, 238, 0.5);
  background: rgba(255, 255, 255, 0.66);
  padding: 12px;
  display: grid;
  gap: 12px;
}

.question-main-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.question-main-card-title {
  font-size: 15px;
  font-weight: 700;
  color: rgba(26, 29, 51, 0.92);
}

.question-select-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.question-select-count {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.62);
  font-weight: 600;
}

.qb-list {
  display: grid;
  gap: 8px;
  border-radius: 12px;
  border: 1px solid rgba(209, 223, 245, 0.58);
  background: rgba(255, 255, 255, 0.75);
  padding: 10px;
}

.qb-item {
  border-radius: 10px;
  border: 1px solid transparent;
  background: rgba(255, 255, 255, 0.85);
  padding: 8px 10px;
}

.qb-item.active {
  border-color: rgba(112, 160, 232, 0.78);
  background: rgba(230, 241, 255, 0.75);
}

.custom-builder {
  display: grid;
  gap: 12px;
}

.custom-builder-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.custom-builder-title {
  font-size: 15px;
  font-weight: 700;
  color: rgba(26, 29, 51, 0.92);
}

.custom-builder-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.custom-type-btn {
  border: 1px solid rgba(183, 201, 230, 0.7);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.86);
  color: rgba(26, 29, 51, 0.76);
  font-size: 12px;
  font-weight: 600;
  padding: 7px 12px;
  cursor: pointer;
  transition: all 0.16s ease;
}

.custom-type-btn:hover {
  border-color: rgba(122, 166, 233, 0.8);
  color: rgba(26, 29, 51, 0.92);
}

.custom-list {
  display: grid;
  gap: 12px;
}

.custom-card {
  border-radius: 12px;
  border: 1px solid rgba(209, 223, 245, 0.58);
  background: rgba(255, 255, 255, 0.8);
  padding: 12px;
  display: grid;
  gap: 10px;
}

.custom-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.custom-card-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.option-list,
.blank-list {
  display: grid;
  gap: 8px;
}

.option-row,
.blank-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.option-id {
  width: 24px;
  font-weight: 700;
  color: rgba(26, 29, 51, 0.66);
}

.answer-option-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.answer-option {
  display: flex;
  align-items: center;
  gap: 6px;
  border-radius: 999px;
  border: 1px solid rgba(203, 217, 241, 0.7);
  background: rgba(255, 255, 255, 0.84);
  padding: 6px 10px;
  font-size: 12px;
  color: rgba(26, 29, 51, 0.78);
}

.qb-action {
  border: 1px solid rgba(185, 205, 236, 0.76);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.8);
  padding: 6px 12px;
  color: rgba(26, 29, 51, 0.78);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.qb-action.danger {
  border-color: rgba(236, 167, 180, 0.8);
  color: rgba(182, 68, 92, 0.92);
  background: rgba(255, 238, 242, 0.9);
}

.qb-action:hover {
  border-color: rgba(120, 165, 236, 0.9);
}

.weight-list {
  display: grid;
  gap: 10px;
}

.weight-row {
  display: grid;
  grid-template-columns: 1fr 120px auto;
  gap: 8px;
  align-items: center;
  padding: 10px 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.6);
}

.weight-title {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
  color: rgba(26, 29, 51, 0.85);
}

.weight-index {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.6);
}

.weight-label {
  font-weight: 600;
  line-height: 1.4;
}

.weight-parent {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.65);
  margin-top: 2px;
}

.weight-input {
  border: 1px solid rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.8);
  border-radius: 10px;
  padding: 6px 8px;
}

.weight-suffix {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.6);
}

.weight-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 6px;
}

.qb-list-scroll {
  max-height: 520px;
  overflow: auto;
  padding-right: 6px;
}

.qb-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 10px;
}

.qb-preview {
  margin-top: 6px;
  font-size: 12px;
  color: rgba(26, 29, 51, 0.65);
  line-height: 1.5;
  padding-left: 22px;
}

.qb-preview-inline {
  margin-left: 12px;
  font-size: 12px;
  color: rgba(26, 29, 51, 0.7);
  line-height: 1.5;
  flex: 0 0 auto;
  display: inline-block;
}

.qb-item-title {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.qb-item-title input[type='checkbox'] {
  align-self: center;
}

.qb-title-text {
  white-space: nowrap;
  line-height: 1.6;
}

.qb-stem {
  line-height: 1.6;
}

.qb-detail-btn {
  margin-left: auto;
  white-space: nowrap;
}

.qb-toggle {
  border: none;
  padding: 8px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  font-weight: 600;
}

.step-panel {
  padding-bottom: 16px;
}

.stepper {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.step-item {
  flex: 0 0 auto;
  border: none;
  padding: 8px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  font-weight: 600;
  color: rgba(26, 29, 51, 0.7);
}

.step-item.active {
  background: linear-gradient(135deg, rgba(90, 140, 255, 0.85), rgba(120, 200, 230, 0.85));
  color: #ffffff;
}

.step-item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.step-arrow {
  flex: 0 0 auto;
  color: rgba(26, 29, 51, 0.45);
  font-size: 15px;
  font-weight: 700;
  line-height: 1;
}

.step-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
}

.compact-textarea {
  min-height: 88px;
}

.ai-assist-group {
  border: none;
  border-radius: 0;
  padding: 0;
  background: transparent;
}

.ai-assist-title {
  display: block;
}

.ai-assist-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.ai-assist-card {
  border: 1px solid rgba(202, 216, 238, 0.34);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.74);
  padding: 10px 12px;
  display: grid;
  gap: 8px;
}

.ai-assist-card-title {
  font-size: 13px;
  font-weight: 700;
  color: rgba(26, 29, 51, 0.88);
}

.strictness-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.strictness-pill {
  border: 1px solid rgba(186, 204, 234, 0.7);
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.78);
  color: rgba(26, 29, 51, 0.86);
  padding: 8px 10px;
  text-align: left;
  cursor: pointer;
  display: grid;
  gap: 2px;
  transition: all 0.15s ease;
}

.strictness-pill:hover:not(:disabled) {
  border-color: rgba(120, 160, 230, 0.85);
}

.strictness-pill.active {
  border-color: rgba(120, 160, 230, 0.9);
  background: rgba(229, 240, 255, 0.9);
}

.strictness-pill:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.strictness-label {
  font-size: 13px;
  font-weight: 700;
}

.strictness-note {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.6);
}

.ai-assist-card input[type='number'],
.ai-assist-card textarea {
  border: 1px solid rgba(151, 177, 223, 0.75);
  background: rgba(255, 255, 255, 0.95);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.45);
}

.ai-assist-card input[type='number']:focus,
.ai-assist-card textarea:focus {
  outline: none;
  border-color: rgba(104, 152, 230, 0.95);
  box-shadow: 0 0 0 3px rgba(117, 168, 235, 0.18);
}

.primary-btn.ghost {
  background: rgba(255, 255, 255, 0.7);
  color: rgba(26, 29, 51, 0.8);
  box-shadow: none;
}

.checkbox-stack {
  display: grid;
  gap: 8px;
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: 8px;
  color: rgba(26, 29, 51, 0.88);
}

.threshold-input-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.threshold-input-row input {
  border: 1px solid rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.8);
  border-radius: 10px;
  padding: 7px 10px;
  width: 180px;
}

.threshold-input-row input:disabled {
  opacity: 0.6;
}

.threshold-helper {
  padding: 0;
  background: transparent;
  box-shadow: none;
  font-size: 12px;
  color: rgba(26, 29, 51, 0.62);
  white-space: nowrap;
}

.ai-estimate-card {
  display: grid;
  gap: 12px;
  margin-bottom: 14px;
  padding: 14px;
  border-radius: 16px;
  border: 1px solid rgba(170, 192, 230, 0.35);
  background: rgba(247, 252, 255, 0.72);
}

.ai-estimate-card.disabled {
  background: rgba(250, 252, 255, 0.55);
}

.estimate-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}

.estimate-title {
  font-size: 14px;
  font-weight: 700;
  color: rgba(26, 29, 51, 0.9);
}

.estimate-hint {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.58);
}

.estimate-disabled-text {
  font-size: 13px;
  color: rgba(26, 29, 51, 0.72);
}

.estimate-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.estimate-item {
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.74);
  border: 1px solid rgba(202, 216, 238, 0.34);
  padding: 10px 12px;
  display: grid;
  gap: 4px;
}

.estimate-label {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.58);
}

.estimate-value {
  font-size: 20px;
  font-weight: 700;
  color: rgba(26, 29, 51, 0.9);
}

.estimate-sub {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.54);
}

.estimate-foot {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.6);
}

@media (max-width: 900px) {
  .question-picker-layout {
    grid-template-columns: 1fr;
  }

  .source-tab-hint {
    margin-left: 0;
    width: 100%;
  }

  .question-main-card-head {
    align-items: flex-start;
  }

  .option-row,
  .blank-row {
    flex-wrap: wrap;
    align-items: flex-start;
  }

  .estimate-grid {
    grid-template-columns: 1fr;
  }

  .ai-assist-grid {
    grid-template-columns: 1fr;
  }

  .strictness-grid {
    grid-template-columns: 1fr;
  }
}
</style>
