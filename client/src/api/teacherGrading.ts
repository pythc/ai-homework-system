import { httpRequest } from './http'

export type TeacherSubmissionItem = {
  submissionId: string
  submissionVersionId: string
  questionId: string
  submitNo: number
  aiStatus: string
  status: string
  scorePublished?: boolean
  contentText: string
  fileUrls: string[]
  submittedAt: string
  student: {
    studentId: string
    name?: string | null
    account?: string | null
  }
}

export type TeacherMissingStudent = {
  studentId: string
  name?: string | null
  account?: string | null
}

type TeacherSubmissionResponse = {
  items: TeacherSubmissionItem[]
}

type TeacherMissingResponse = {
  items: TeacherMissingStudent[]
}

export async function listSubmissionsByAssignment(assignmentId: string) {
  return httpRequest<TeacherSubmissionResponse>(
    `/submissions/by-assignment/${assignmentId}`,
    { method: 'GET' },
  )
}

export async function listMissingByAssignment(assignmentId: string) {
  return httpRequest<TeacherMissingResponse>(
    `/submissions/by-assignment/${assignmentId}/missing`,
    { method: 'GET' },
  )
}
