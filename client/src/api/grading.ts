import { httpRequest } from './http'

export type GradingItemInput = {
  questionIndex: number
  rubricItemKey: string
  score: number
  reason?: string
}

export type SubmitGradingInput = {
  source: 'MANUAL' | 'AI_ADOPTED' | 'MIXED'
  totalScore: number
  finalComment?: string
  items: GradingItemInput[]
}

type SubmitGradingResponse = {
  gradingId: string
  status: string
  totalScore: number
  updatedAt: string
}

export async function submitFinalGrading(
  submissionVersionId: string,
  payload: SubmitGradingInput,
) {
  return httpRequest<SubmitGradingResponse>(
    `/submissions/${submissionVersionId}/grading`,
    {
      method: 'PUT',
      body: payload,
    },
  )
}

type FinalGradingResponse = {
  gradingId: string
  status: string
  totalScore: number
  source?: string | null
  items?: Array<{
    questionIndex?: number
    rubricItemKey?: string
    score?: number
    reason?: string
  }>
  finalComment?: string | null
  updatedAt?: string
}

export async function getFinalGrading(submissionVersionId: string) {
  return httpRequest<FinalGradingResponse>(
    `/submissions/${submissionVersionId}/grading`,
    { method: 'GET' },
  )
}
