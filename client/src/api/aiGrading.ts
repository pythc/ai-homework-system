import { httpRequest } from './http'

export type AiJobStatusResponse = {
  aiJobId: string
  status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED'
  progress?: { stage?: string }
  error?: string | null
  updatedAt?: string
}

export type AiGradingResult = {
  aiGradingId: string
  submissionVersionId: string
  assignmentSnapshotId: string
  model?: { name?: string; version?: string }
  result: {
    comment?: string
    confidence?: number
    isUncertain?: boolean
    uncertaintyReasons?: Array<{
      code?: string
      message?: string
      questionIndex?: number
    }>
    items?: Array<{
      questionIndex?: number
      rubricItemKey?: string
      score?: number
      maxScore?: number
      reason?: string
      uncertaintyScore?: number
    }>
    totalScore?: number
  }
  extracted?: { studentMarkdown?: string }
  createdAt?: string
}

export async function getAiJobStatus(submissionVersionId: string) {
  return httpRequest<AiJobStatusResponse>(
    `/submissions/${submissionVersionId}/ai-grading/job`,
    { method: 'GET' },
  )
}

export async function getAiGradingResult(submissionVersionId: string) {
  return httpRequest<AiGradingResult>(
    `/submissions/${submissionVersionId}/ai-grading`,
    { method: 'GET' },
  )
}
