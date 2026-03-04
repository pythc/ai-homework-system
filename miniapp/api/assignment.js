import { request } from '../utils/http'

export async function listAllAssignments() {
  const data = await request('/assignments/all-list', { method: 'GET' })
  return data?.items || []
}

export async function listTeacherAssignments() {
  const data = await request('/assignments/teacher-list', { method: 'GET' })
  return data?.items || []
}

export async function listOpenAssignments() {
  const data = await request('/assignments/open', { method: 'GET' })
  return data?.items || []
}

export async function getAssignmentSnapshot(assignmentId) {
  return request(`/assignments/${assignmentId}/snapshot`, { method: 'GET' })
}

export async function getAssignment(assignmentId) {
  return request(`/assignments/${assignmentId}`, { method: 'GET' })
}
