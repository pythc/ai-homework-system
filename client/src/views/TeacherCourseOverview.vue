<template>
  <TeacherLayout
    title="课程概况"
    :subtitle="courseTitle"
    :profile-name="profileName"
    :profile-account="profileAccount"
    brand-sub="课程中心"
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

    <section class="panel glass">
      <div class="panel-title panel-title-row">
        <div>课程信息</div>
        <div class="action-row">
          <button class="ghost-action" @click="goBack">返回课程</button>
        </div>
      </div>

      <div v-if="editMode" class="edit-form">
        <div class="form-item">
          <label>课程名称</label>
          <input v-model.trim="editName" type="text" placeholder="请输入课程名称" />
        </div>
        <div class="form-item">
          <label>学期</label>
          <select v-model="editSemester">
            <option value="上学期">上学期</option>
            <option value="下学期">下学期</option>
          </select>
        </div>
        <div class="form-actions">
          <button class="primary-btn" :disabled="savingEdit" @click="saveEdit">
            {{ savingEdit ? '保存中...' : '保存修改' }}
          </button>
        </div>
      </div>

      <div class="summary-grid">
        <div class="summary-card">
          <div class="summary-label">课程名称</div>
          <div class="summary-value">{{ summary.course?.name || '--' }}</div>
          <div class="summary-sub">{{ summary.course?.semester || '' }}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">学生人数</div>
          <div class="summary-value metric-large">{{ summary.studentCount }}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">作业次数</div>
          <div class="summary-value metric-large">{{ summary.assignmentCount }}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">课程状态</div>
          <div class="summary-value status-large">{{ statusLabel }}</div>
        </div>
      </div>

      <div class="summary-actions button-group">
        <button class="action-btn action-btn-blue" type="button" @click="toggleEdit">
          {{ editMode ? '取消编辑' : '编辑课程' }}
        </button>
        <button
          class="action-btn action-btn-blue"
          type="button"
          :disabled="statusSaving"
          @click="toggleCourseStatus"
        >
          {{ statusSaving ? '处理中...' : statusToggleText }}
        </button>
        <button class="action-btn action-btn-blue" type="button" @click="goGradebook">查看成绩矩阵</button>
        <button class="action-btn action-btn-danger" :disabled="deleteLoading" @click="handleDeleteCourse">
          {{ deleteLoading ? '删除中...' : '删除课程' }}
        </button>
      </div>
    </section>

    <section class="panel glass">
      <div class="panel-title">作业状态概览</div>
      <div class="status-grid">
        <div class="status-card">
          <div class="status-label">进行中作业</div>
          <div class="status-value">{{ assignmentStats.openCount }}</div>
        </div>
        <div class="status-card">
          <div class="status-label">待批改</div>
          <div class="status-value">{{ assignmentStats.pendingReview }}</div>
        </div>
        <div class="status-card">
          <div class="status-label">未提交总数</div>
          <div class="status-value">{{ assignmentStats.unsubmittedTotal }}</div>
        </div>
        <div class="status-card">
          <div class="status-label">AI异常</div>
          <div class="status-value danger-text">{{ assignmentStats.aiFailedTotal }}</div>
        </div>
      </div>

      <div class="risk-row">
        <div class="risk-title">风险提醒</div>
        <div class="risk-list">
          <span v-if="!riskMessages.length" class="risk-ok">当前无明显风险</span>
          <span v-for="message in riskMessages" :key="message" class="risk-item">{{ message }}</span>
        </div>
      </div>
    </section>

    <section class="panel glass">
      <div class="panel-title panel-title-row">
        <div>班级成员预览</div>
        <div class="member-tools">
          <input
            v-model.trim="memberKeyword"
            type="text"
            placeholder="搜索姓名/学号"
            class="member-search"
          />
          <button class="ghost-action" @click="exportMembers">导出成员</button>
        </div>
      </div>

      <div class="member-maintain">
        <input
          v-model.trim="newStudentAccount"
          type="text"
          placeholder="输入学生学号"
          class="member-add-input"
        />
        <input
          v-model.trim="newStudentName"
          type="text"
          placeholder="输入学生姓名"
          class="member-add-input"
        />
        <button class="primary-btn" :disabled="addingStudent" @click="addStudent">
          {{ addingStudent ? '添加中...' : '添加学生' }}
        </button>
      </div>

      <div v-if="!filteredStudents.length" class="member-empty">
        {{ memberKeyword ? '未匹配到成员' : '暂无班级成员' }}
      </div>
      <div v-else class="member-list">
        <div v-for="item in filteredStudents" :key="item.studentId" class="member-item">
          <div class="member-meta">
            <span class="member-name">{{ item.name || '未命名学生' }}</span>
            <span class="member-account">{{ item.account || '--' }}</span>
          </div>
          <button class="remove-btn" :disabled="removingIds.has(item.studentId)" @click="removeStudent(item)">
            {{ removingIds.has(item.studentId) ? '移除中...' : '移除' }}
          </button>
        </div>
      </div>
    </section>
  </TeacherLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import TeacherLayout from '../components/TeacherLayout.vue'
import {
  addCourseStudent,
  getCourseGradebook,
  deleteCourse,
  getCourseSummary,
  listCourseStudents,
  removeCourseStudent,
  updateCourse,
} from '../api/course'
import { listTeacherAssignments } from '../api/assignment'
import { useTeacherProfile } from '../composables/useTeacherProfile'
import { showAppToast } from '../composables/useAppToast'

type CourseStudent = { studentId: string; name?: string | null; account?: string | null }

const { profileName, profileAccount, refreshProfile } = useTeacherProfile()
const route = useRoute()
const router = useRouter()

const courseId = computed(() => String(route.params.courseId ?? ''))
const summary = ref<any>({ course: null, studentCount: 0, assignmentCount: 0 })
const students = ref<CourseStudent[]>([])
const assignments = ref<any[]>([])
const gradebookAssignments = ref<Array<{ id: string; title: string }>>([])
const gradebookCellMap = ref<Record<string, Record<string, number | null>>>({})

const deleteLoading = ref(false)
const statusSaving = ref(false)
const editMode = ref(false)
const savingEdit = ref(false)
const editName = ref('')
const editSemester = ref('上学期')
const memberKeyword = ref('')
const newStudentAccount = ref('')
const newStudentName = ref('')
const addingStudent = ref(false)
const removingIds = ref(new Set<string>())

const courseTitle = computed(() => summary.value.course?.name || '课程概况')
const statusLabel = computed(() => (summary.value.course?.status === 'ACTIVE' ? '开放中' : '已结课'))
const statusToggleText = computed(() =>
  summary.value.course?.status === 'ACTIVE' ? '结课' : '开放',
)

const filteredStudents = computed(() => {
  const keyword = memberKeyword.value.trim().toLowerCase()
  if (!keyword) return students.value
  return students.value.filter((item) => {
    const name = String(item.name ?? '').toLowerCase()
    const account = String(item.account ?? '').toLowerCase()
    return name.includes(keyword) || account.includes(keyword)
  })
})

const assignmentStats = computed(() => {
  const courseAssignments = assignments.value.filter((item) => item.courseId === courseId.value)
  const openCount = courseAssignments.filter((item) => item.status === 'OPEN').length
  const pendingReview = courseAssignments.reduce(
    (sum, item) => sum + Number(item.pendingCount ?? item.pendingStudentCount ?? 0),
    0,
  )
  const unsubmittedTotal = courseAssignments.reduce(
    (sum, item) => sum + Number(item.unsubmittedCount ?? 0),
    0,
  )
  const aiFailedTotal = courseAssignments.reduce(
    (sum, item) => sum + Number(item.aiFailedCount ?? 0),
    0,
  )
  return { openCount, pendingReview, unsubmittedTotal, aiFailedTotal }
})

const riskMessages = computed(() => {
  const messages: string[] = []
  if (Number(summary.value.assignmentCount ?? 0) === 0) {
    messages.push('当前课程还没有发布作业')
  }
  if (assignmentStats.value.unsubmittedTotal > 0) {
    messages.push(`有 ${assignmentStats.value.unsubmittedTotal} 份未提交`)
  }
  if (assignmentStats.value.pendingReview > 0) {
    messages.push(`有 ${assignmentStats.value.pendingReview} 份待批改`)
  }
  if (assignmentStats.value.aiFailedTotal > 0) {
    messages.push(`有 ${assignmentStats.value.aiFailedTotal} 条 AI 异常`)
  }
  return messages
})

const goBack = () => {
  router.push('/teacher/courses')
}

const goGradebook = () => {
  router.push(`/teacher/courses/${courseId.value}/gradebook`)
}

const loadData = async () => {
  if (!courseId.value) return
  summary.value = await getCourseSummary(courseId.value)
  const memberResponse = await listCourseStudents(courseId.value)
  students.value = memberResponse.items ?? []
  const assignmentResponse = await listTeacherAssignments()
  assignments.value = assignmentResponse.items ?? []
  const gradebook = await getCourseGradebook(courseId.value)
  gradebookAssignments.value = (gradebook.assignments ?? []).map((item: any) => ({
    id: item.id,
    title: item.title,
  }))
  gradebookCellMap.value = buildGradebookCellMap(gradebook.cells ?? [])
  editName.value = summary.value.course?.name ?? ''
  editSemester.value = summary.value.course?.semester ?? '上学期'
}

const toggleEdit = () => {
  editMode.value = !editMode.value
  if (editMode.value) {
    editName.value = summary.value.course?.name ?? ''
    editSemester.value = summary.value.course?.semester ?? '上学期'
  }
}

const saveEdit = async () => {
  if (!courseId.value) return
  if (!editName.value.trim()) {
    showAppToast('课程名称不能为空', 'error')
    return
  }
  savingEdit.value = true
  try {
    await updateCourse(courseId.value, {
      name: editName.value.trim(),
      semester: editSemester.value,
    })
    editMode.value = false
    await loadData()
  } catch (err) {
    showAppToast(err instanceof Error ? err.message : '保存失败', 'error')
  } finally {
    savingEdit.value = false
  }
}

const handleDeleteCourse = async () => {
  if (!courseId.value) return
  if (!window.confirm('确认删除该课程吗？此操作不可恢复。')) return
  deleteLoading.value = true
  try {
    await deleteCourse(courseId.value)
    showAppToast('课程已删除', 'success')
    router.push('/teacher/courses')
  } catch (err) {
    showAppToast(err instanceof Error ? err.message : '删除课程失败', 'error')
  } finally {
    deleteLoading.value = false
  }
}

const toggleCourseStatus = async () => {
  if (!courseId.value || !summary.value.course?.status) return
  statusSaving.value = true
  try {
    const nextStatus = summary.value.course.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE'
    await updateCourse(courseId.value, { status: nextStatus })
    showAppToast(nextStatus === 'ACTIVE' ? '课程已开放' : '课程已结课', 'success')
    await loadData()
  } catch (err) {
    showAppToast(err instanceof Error ? err.message : '更新课程状态失败', 'error')
  } finally {
    statusSaving.value = false
  }
}

const exportMembers = () => {
  const assignmentHeaders = gradebookAssignments.value.map((item) => item.title)
  const lines = [['序号', '姓名', '学号', ...assignmentHeaders].join(',')]
  filteredStudents.value.forEach((item, index) => {
    const name = String(item.name ?? '').split(',').join(' ')
    const account = String(item.account ?? '').split(',').join(' ')
    const scoreList = gradebookAssignments.value.map((assignment) => {
      const score = gradebookCellMap.value[item.studentId]?.[assignment.id]
      if (score === null || score === undefined || Number.isNaN(score)) return '-'
      return Number(score).toFixed(1)
    })
    lines.push([String(index + 1), name, account, ...scoreList].join(','))
  })
  if (filteredStudents.value.length === 0) {
    lines.push('1,暂无数据,暂无数据')
  }
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${summary.value.course?.name ?? '课程'}-成员名单.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const addStudent = async () => {
  if (!courseId.value) return
  const account = newStudentAccount.value.trim()
  const name = newStudentName.value.trim()
  if (!account) {
    showAppToast('请输入学生学号', 'error')
    return
  }
  if (!name) {
    showAppToast('请输入学生姓名', 'error')
    return
  }
  addingStudent.value = true
  try {
    const response = await addCourseStudent(courseId.value, account, name)
    if (response.created) {
      showAppToast(
        `未找到该学生账号，已自动创建并加入班级。初始密码：${response.defaultPassword || '123456'}`,
        'info',
        3600,
      )
    } else {
      showAppToast('学生已加入班级', 'success')
    }
    newStudentAccount.value = ''
    newStudentName.value = ''
    await loadData()
  } catch (err) {
    showAppToast(err instanceof Error ? err.message : '添加学生失败', 'error')
  } finally {
    addingStudent.value = false
  }
}

const buildGradebookCellMap = (cells: any[]) => {
  const map: Record<string, Record<string, number | null>> = {}
  cells.forEach((cell: any) => {
    if (!cell?.studentId || !cell?.assignmentId) return
    if (!map[cell.studentId]) map[cell.studentId] = {}
    const studentMap = map[cell.studentId]!
    const finalScore = cell.finalScore
    const aiScore = cell.aiScore
    const score =
      finalScore !== null && finalScore !== undefined
        ? Number(finalScore)
        : aiScore !== null && aiScore !== undefined
          ? Number(aiScore)
          : null
    studentMap[cell.assignmentId] = Number.isFinite(score as number)
      ? (score as number)
      : null
  })
  return map
}

const removeStudent = async (student: CourseStudent) => {
  if (!courseId.value) return
  if (!window.confirm(`确认移除学生 ${student.name || student.account || ''} 吗？`)) return
  const set = new Set(removingIds.value)
  set.add(student.studentId)
  removingIds.value = set
  try {
    await removeCourseStudent(courseId.value, student.studentId)
    showAppToast('学生已移除', 'success')
    await loadData()
  } catch (err) {
    showAppToast(err instanceof Error ? err.message : '移除学生失败', 'error')
  } finally {
    const next = new Set(removingIds.value)
    next.delete(student.studentId)
    removingIds.value = next
  }
}

onMounted(async () => {
  await refreshProfile()
  await loadData()
})
</script>

<style scoped>
.panel-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.action-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ghost-action {
  border: none;
  background: rgba(255, 255, 255, 0.7);
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 12px;
  color: rgba(26, 29, 51, 0.7);
  cursor: pointer;
}

.danger-action {
  border: none;
  background: rgba(232, 84, 84, 0.12);
  color: #cc4040;
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.danger-action:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.edit-form {
  margin-bottom: 12px;
  display: grid;
  grid-template-columns: repeat(2, minmax(180px, 1fr)) auto;
  gap: 10px;
  align-items: end;
}

.form-item {
  display: grid;
  gap: 6px;
}

.form-item label {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.64);
  font-weight: 700;
}

.form-item input,
.form-item select {
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.72);
  background: rgba(255, 255, 255, 0.78);
  padding: 8px 10px;
  font-size: 13px;
}

.summary-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

.summary-card {
  padding: 14px 16px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.75);
}

.summary-label {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.6);
}

.summary-value {
  margin-top: 6px;
  font-size: 18px;
  font-weight: 700;
}

.summary-value.metric-large {
  font-size: 36px;
  line-height: 1;
}

.summary-value.status-large {
  font-size: 30px;
  line-height: 1.1;
}

.summary-sub {
  margin-top: 4px;
  font-size: 12px;
  color: rgba(26, 29, 51, 0.55);
}

.summary-actions {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
}

.summary-actions.button-group {
  gap: 8px;
  flex-wrap: wrap;
}

.action-btn {
  border: none;
  border-radius: 12px;
  padding: 9px 18px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.action-btn-blue {
  background: linear-gradient(135deg, #5e96ff, #69d4dd);
  color: #fff;
}

.action-btn-danger {
  background: rgba(232, 84, 84, 0.14);
  color: #cc4040;
}

.action-btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.status-grid {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
}

.status-card {
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.72);
  padding: 12px 14px;
}

.status-label {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.58);
}

.status-value {
  margin-top: 6px;
  font-size: 24px;
  font-weight: 800;
  color: #28314b;
}

.danger-text {
  color: #cc4040;
}

.risk-row {
  margin-top: 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.7);
  padding: 10px;
}

.risk-title {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.62);
  font-weight: 700;
  margin-bottom: 8px;
}

.risk-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.risk-item {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(232, 84, 84, 0.14);
  color: #c04242;
  font-weight: 700;
}

.risk-ok {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(47, 179, 107, 0.16);
  color: #2f8f59;
  font-weight: 700;
}

.member-tools {
  display: flex;
  align-items: center;
  gap: 8px;
}

.member-search {
  width: 200px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.74);
  background: rgba(255, 255, 255, 0.78);
  padding: 7px 10px;
  font-size: 12px;
}

.member-maintain {
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.member-add-input {
  width: 260px;
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.74);
  background: rgba(255, 255, 255, 0.78);
  padding: 8px 10px;
  font-size: 13px;
}

.member-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 8px;
}

.member-item {
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(255, 255, 255, 0.88);
  padding: 8px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.member-meta {
  display: grid;
  gap: 2px;
}

.member-name {
  font-size: 13px;
  font-weight: 700;
  color: rgba(26, 29, 51, 0.82);
}

.member-account {
  font-size: 12px;
  color: rgba(26, 29, 51, 0.58);
}

.remove-btn {
  border: none;
  border-radius: 999px;
  background: rgba(232, 84, 84, 0.12);
  color: #cc4040;
  font-size: 12px;
  padding: 4px 10px;
  cursor: pointer;
}

.remove-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.member-empty {
  font-size: 13px;
  color: rgba(26, 29, 51, 0.55);
}

@media (max-width: 980px) {
  .edit-form {
    grid-template-columns: 1fr;
  }
  .member-tools {
    width: 100%;
    justify-content: flex-start;
  }
  .member-search,
  .member-add-input {
    width: 100%;
  }
  .member-maintain {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
