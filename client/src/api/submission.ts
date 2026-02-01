import { API_BASE_URL } from './http'
import { getAccessToken } from '../auth/storage'

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
    }>
  }
}

export async function uploadSubmission(params: {
  assignmentId: string
  answers: SubmissionAnswerInput[]
  filesByQuestion: Record<string, File[]>
}) {
  const token = getAccessToken()
  if (!token) {
    throw new Error('未登录或登录已过期')
  }

  const formData = new FormData()
  formData.append('assignmentId', params.assignmentId)
  formData.append('answers', JSON.stringify(params.answers))

  Object.entries(params.filesByQuestion).forEach(([questionId, files]) => {
    files.forEach((file) => {
      formData.append(`files[${questionId}]`, file)
    })
  })

  const response = await fetch(`${API_BASE_URL}/submissions/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  })

  let payload: SubmissionResponse | null = null
  try {
    payload = await response.json()
  } catch (err) {
    payload = null
  }

  if (!response.ok) {
    const message = (payload as { message?: string } | null)?.message ?? '提交失败'
    throw new Error(message)
  }

  return payload as SubmissionResponse
}
