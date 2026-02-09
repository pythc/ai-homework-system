import { httpRequest } from './http'

export type SubmissionAnswerInput = {
  questionId: string
  contentText?: string
}

type SubmissionResponse = {
  code: number
  message: string
  data?: {
    assignmentId: string
    submitNo: number
    items: Array<{
      questionId: string
      submissionVersionId: string
      submissionId: string
      fileUrls: string[]
      aiStatus?: string
    }>
    aiEnabled?: boolean
  }
}

export async function uploadSubmission(params: {
  assignmentId: string
  answers: SubmissionAnswerInput[]
  filesByQuestion: Record<string, File[]>
}) {
  const formData = new FormData()
  formData.append('assignmentId', params.assignmentId)
  formData.append('answers', JSON.stringify(params.answers))

  Object.entries(params.filesByQuestion).forEach(([questionId, files]) => {
    files.forEach((file) => {
      formData.append(`files[${questionId}]`, file)
    })
  })

  return httpRequest<SubmissionResponse>('/submissions/upload', {
    method: 'POST',
    body: formData,
  })
}

export type SubmissionVersionResponse = {
  submissionVersionId: string
  submissionId: string
  assignmentId: string
  courseId: string
  studentId: string
  questionId: string
  submitNo: number
  fileUrls: string[]
  contentText?: string | null
  status: string
  aiStatus: string
  submittedAt: string
  updatedAt: string
}

export async function getSubmissionVersion(submissionVersionId: string) {
  return httpRequest<SubmissionVersionResponse>(
    `/submissions/${submissionVersionId}`,
    { method: 'GET' },
  )
}

type LatestSubmissionItem = {
  submissionId: string
  submissionVersionId: string
  questionId: string
  submitNo: number
  contentText: string
  fileUrls: string[]
  submittedAt: string
  isFinal?: boolean
}

export async function listLatestSubmissions(assignmentId: string) {
  return httpRequest<{ items: LatestSubmissionItem[] }>(
    `/submissions/latest/${assignmentId}`,
    { method: 'GET' },
  )
}
