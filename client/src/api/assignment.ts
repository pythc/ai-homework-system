import { httpRequest } from './http'
import { getAccessToken } from '../auth/storage'

export type AiGradingStrictness = 'LENIENT' | 'BALANCED' | 'STRICT'
export type QuestionType =
  | 'SINGLE_CHOICE'
  | 'MULTI_CHOICE'
  | 'FILL_BLANK'
  | 'JUDGE'
  | 'SHORT_ANSWER'
  | 'ESSAY'
  | 'CALCULATION'
  | 'PROOF'

export type AssignmentSummary = {
  id: string
  title: string
  courseId: string
  courseName?: string | null
  description?: string | null
  totalScore?: number
  deadline?: string | null
  createdAt?: string | null
  status: string
  aiEnabled?: boolean
  submitted?: boolean
  visibleAfterSubmit?: boolean
  allowViewAnswer?: boolean
  allowViewScore?: boolean
  handwritingRecognition?: boolean
  aiPromptGuidance?: string | null
  aiGradingStrictness?: AiGradingStrictness
  aiConfidenceThreshold?: number
  selectedQuestionIds?: string[]
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
  aiSuccessCount?: number
  aiFailedCount?: number
}

type TeacherAssignmentListResponse = {
  items: TeacherAssignmentSummary[]
}

export type AssignmentSnapshotQuestion = {
  questionIndex: number
  questionId: string
  questionType?: QuestionType
  questionSchema?: Record<string, unknown> | null
  gradingPolicy?: Record<string, unknown> | null
  defaultScore?: number | null
  weight?: number | null
  prompt?: { text?: string; media?: Array<{ url: string; caption?: string }> } | string
  parentPrompt?: { text?: string }
  standardAnswer?: { text?: string } | Record<string, unknown> | string
  rubric?: Array<{ rubricItemKey: string; maxScore: number; criteria: string }>
}

export type AssignmentSnapshotResponse = {
  assignmentSnapshotId: string
  assignmentId: string
  visibleAfterSubmit?: boolean
  allowViewAnswer?: boolean
  allowViewScore?: boolean
  handwritingRecognition?: boolean
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
  visibleAfterSubmit?: boolean
  allowViewAnswer?: boolean
  allowViewScore?: boolean
  handwritingRecognition?: boolean
  aiPromptGuidance?: string
  aiGradingStrictness?: AiGradingStrictness
  aiConfidenceThreshold?: number
  selectedQuestionIds?: string[]
  questions?: Array<{
    questionCode?: string
    questionIndex?: number
    title?: string
    prompt: string
    standardAnswer?: unknown
    questionType?: QuestionType
    defaultScore?: number
    rubric?: Array<{ rubricItemKey: string; maxScore: number; criteria: string }>
    questionSchema?: Record<string, unknown>
    gradingPolicy?: Record<string, unknown>
  }>
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

export async function getAssignment(assignmentId: string) {
  const token = getAccessToken()
  return httpRequest<AssignmentSummary>(`/assignments/${assignmentId}`, {
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

export async function updateAssignmentGradingConfig(
  assignmentId: string,
  payload: {
    deadline?: string
    totalScore?: number
    aiEnabled?: boolean
    visibleAfterSubmit?: boolean
    allowViewAnswer?: boolean
    allowViewScore?: boolean
    handwritingRecognition?: boolean
    aiPromptGuidance?: string
    aiGradingStrictness?: AiGradingStrictness
    aiConfidenceThreshold?: number
    questionWeights?: Array<{ questionId: string; weight: number }>
  },
) {
  const token = getAccessToken()
  return httpRequest<{ assignment: AssignmentSummary; needRepublish: boolean }>(
    `/assignments/${assignmentId}/grading-config`,
    {
      method: 'PUT',
      token,
      body: payload,
    },
  )
}

export async function deleteAssignment(assignmentId: string) {
  const token = getAccessToken()
  return httpRequest<{ success: boolean }>(`/assignments/${assignmentId}`, {
    method: 'DELETE',
    token,
  })
}
