import { httpRequest } from './http'
import { getAccessToken } from '../auth/storage'

export type AssignmentSummary = {
  id: string
  title: string
  courseId: string
  courseName?: string | null
  description?: string | null
  deadline?: string | null
  status: string
  submitted?: boolean
}

type AssignmentListResponse = {
  items: AssignmentSummary[]
}

export type TeacherAssignmentSummary = AssignmentSummary & {
  submissionCount: number
  gradedCount: number
  pendingCount: number
  unsubmittedCount?: number
  studentCount?: number
  submittedStudentCount?: number
  pendingStudentCount?: number
  gradedStudentCount?: number
}

type TeacherAssignmentListResponse = {
  items: TeacherAssignmentSummary[]
}

export type AssignmentSnapshotQuestion = {
  questionIndex: number
  questionId: string
  prompt?: { text?: string }
  parentPrompt?: { text?: string }
  standardAnswer?: { text?: string }
  rubric?: Array<{ rubricItemKey: string; maxScore: number; criteria: string }>
}

export type AssignmentSnapshotResponse = {
  assignmentSnapshotId: string
  assignmentId: string
  questions: AssignmentSnapshotQuestion[]
  createdAt: string
}

export type CreateAssignmentRequest = {
  courseId: string
  title: string
  description?: string
  deadline?: string
  totalScore?: number
  aiEnabled?: boolean
  selectedQuestionIds?: string[]
}

export async function listOpenAssignments() {
  const token = getAccessToken()
  return httpRequest<AssignmentListResponse>('/assignments/open', {
    method: 'GET',
    token,
  })
}

export async function listAllAssignments() {
  const token = getAccessToken()
  return httpRequest<AssignmentListResponse>('/assignments/all-list', {
    method: 'GET',
    token,
  })
}

export async function listTeacherAssignments() {
  const token = getAccessToken()
  return httpRequest<TeacherAssignmentListResponse>('/assignments/teacher-list', {
    method: 'GET',
    token,
  })
}

export async function getAssignmentSnapshot(assignmentId: string) {
  const token = getAccessToken()
  return httpRequest<AssignmentSnapshotResponse>(`/assignments/${assignmentId}/snapshot`, {
    method: 'GET',
    token,
  })
}

export async function createAssignment(payload: CreateAssignmentRequest) {
  const token = getAccessToken()
  return httpRequest<AssignmentSummary>('/assignments', {
    method: 'POST',
    token,
    body: payload,
  })
}

export async function updateAssignmentMeta(
  assignmentId: string,
  payload: Partial<CreateAssignmentRequest>,
) {
  const token = getAccessToken()
  return httpRequest<AssignmentSummary>(`/assignments/${assignmentId}`, {
    method: 'PATCH',
    token,
    body: payload,
  })
}

export async function replaceAssignmentQuestions(
  assignmentId: string,
  selectedQuestionIds: string[],
) {
  const token = getAccessToken()
  return httpRequest<AssignmentSummary>(`/assignments/${assignmentId}/questions`, {
    method: 'PUT',
    token,
    body: { selectedQuestionIds },
  })
}

export async function publishAssignment(
  assignmentId: string,
  payload?: { questionWeights: Array<{ questionId: string; weight: number }> },
) {
  const token = getAccessToken()
  return httpRequest<{ assignment: AssignmentSummary }>(`/assignments/${assignmentId}/publish`, {
    method: 'POST',
    token,
    body: payload,
  })
}
