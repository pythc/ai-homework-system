import { httpRequest } from './http'
import { getAccessToken } from '../auth/storage'

export type ScoreSummary = {
  scoreId: string
  submissionVersionId: string | null
  assignmentId: string
  assignmentTitle: string
  courseId: string
  courseName?: string | null
  totalScore: number | null
  updatedAt: string | null
  status?: 'GRADED' | 'UNSUBMITTED'
}

type ScoreListResponse = {
  items: ScoreSummary[]
}

export async function listMyScores() {
  const token = getAccessToken()
  return httpRequest<ScoreListResponse>('/scores/me', {
    method: 'GET',
    token,
  })
}

export async function getAssignmentScoreDetail(assignmentId: string) {
  const token = getAccessToken()
  return httpRequest<{
    assignmentId: string
    assignmentTitle: string
    courseId: string
    courseName?: string | null
    totalScore: number | null
    weightedScore: number | null
    allowViewAnswer?: boolean
    allowViewScore?: boolean
    updatedAt: string | null
    status?: 'GRADED' | 'UNSUBMITTED'
    questions: Array<{
      questionId: string | null
      questionIndex: number
      promptText: string
      standardAnswerText?: string | null
      weight: number
      maxScore: number
      score: number | null
      source?: string | null
      items?: Array<{ rubricItemKey?: string; score?: number; reason?: string }>
      finalComment?: string | null
    }>
  }>(`/scores/me/${assignmentId}`, {
    method: 'GET',
    token,
  })
}

export async function publishAssignmentScores(assignmentId: string, studentId: string) {
  const token = getAccessToken('teacher')
  return httpRequest<{ status: string }>('/scores/publish', {
    method: 'POST',
    token,
    body: { assignmentId, studentId },
  })
}
