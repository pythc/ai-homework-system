import { httpRequest } from './http'
import { getAccessToken } from '../auth/storage'

export type AssignmentSummary = {
  id: string
  title: string
  courseId: string
  courseName?: string | null
  description?: string | null
  deadline?: string | null
  status: string
  submitted?: boolean
}

type AssignmentListResponse = {
  items: AssignmentSummary[]
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
