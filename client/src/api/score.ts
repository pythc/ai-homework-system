import { httpRequest } from './http'
import { getAccessToken } from '../auth/storage'

export type ScoreSummary = {
  scoreId: string
  submissionVersionId: string | null
  assignmentId: string
  assignmentTitle: string
  courseId: string
  courseName?: string | null
  totalScore: number
  updatedAt: string
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
    totalScore: number
    weightedScore: number
    updatedAt: string
    questions: Array<{
      questionId: string
      questionIndex: number
      promptText: string
      weight: number
      maxScore: number
      score: number
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
