import { httpRequest } from './http'

export type TeacherSubmissionItem = {
  submissionId: string
  submissionVersionId: string
  questionId: string
  submitNo: number
  aiStatus: string
  status: string
  contentText: string
  fileUrls: string[]
  submittedAt: string
  student: {
    studentId: string
    name?: string | null
    account?: string | null
  }
}

type TeacherSubmissionResponse = {
  items: TeacherSubmissionItem[]
}

export async function listSubmissionsByAssignment(assignmentId: string) {
  return httpRequest<TeacherSubmissionResponse>(
    `/submissions/by-assignment/${assignmentId}`,
    { method: 'GET' },
  )
}
