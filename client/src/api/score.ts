import { httpRequest } from './http'
import { getAccessToken } from '../auth/storage'

export type ScoreSummary = {
  scoreId: string
  submissionVersionId: string
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
